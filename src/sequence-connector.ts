import { sequence, Wallet } from '0xsequence'
import { Chain } from '@rainbow-me/rainbowkit'
import { ethers, TypedDataDomain, TypedDataField } from 'ethers'

import {
  createWalletClient,
  custom,
  UserRejectedRequestError
} from 'viem'

import { Connector, ConnectorData, ConnectorNotFoundError } from 'wagmi'

interface Options {
  connect?: sequence.provider.ConnectOptions
  useEIP6492?: boolean
}

export class SharedChainID {
  private static chainID: number
  private static callbacks: ((chainID: number) => void)[] = []

  static onChange(callback: (chainID: number) => void) {
    this.callbacks.push(callback)
  }

  static set(chainID: number) {
    this.chainID = chainID
    this.callbacks.forEach((cb) => cb(chainID))
  }

  static get() {
    return this.chainID
  }
}

export class SharedEIP6492Status {
  static enabled: boolean

  static setEIP6492(enabled: boolean) {
    this.enabled = enabled
  }
}

export class SequenceConnector extends Connector<SwitchingProvider, Options | undefined> {
  id = 'sequence'
  name = 'Sequence'
  ready = true

  provider: SwitchingProvider | null = null
  signer: SwitchingSigner | null = null

  wallet?: sequence.provider.Wallet
  connected = false

  // NOTICE: The chainId is a singleton
  // this is because rainbowkit expects the whole wallet to switch networks
  // at once, and we can't avoid rainbowkit from creating multiple connectors
  // so we mimic the same behavior here.
  chainId = SharedChainID

  // NOTICE: The EIP6492 status is a singleton
  // this is because rainbowkit doesn't give the dapp an option to interact
  // with the connector after it's been created, and we need a way to enable
  // and disable EIP6492 support on the fly.
  eip6492 = SharedEIP6492Status

  constructor({ chains, options }: { chains?: Chain[]; options?: Options }) {
    super({ chains, options })

    if (this.chainId.get() === undefined) {
      if (options?.connect?.networkId) {
        this.chainId.set(normalizeChainId(options?.connect?.networkId))
      } else {
        this.chainId.set(chains?.[0]?.id || 1)
      }
    }

    if (options?.useEIP6492) {
      this.eip6492.setEIP6492(true)
    }
  }

  async connect(): Promise<Required<ConnectorData>> {
    if (!this.wallet) {
      this.wallet = await sequence.initWallet()
    }
    if (!this.wallet.isConnected()) {
      // @ts-ignore-next-line
      this?.emit('message', { type: 'connecting' })
      const e = await this.wallet.connect(this.options?.connect)
      if (e.error) {
        throw new UserRejectedRequestError(new Error(e.error))
      }
      if (!e.connected) {
        throw new UserRejectedRequestError(new Error('Wallet connection rejected'))
      }
    }

    const chainId = await this.getChainId()
    const provider = await this.getProvider()
    const account = await this.getAccount()

    this.chainId.onChange((chainID) => {
      console.log('chain changed', chainID)
      // @ts-ignore-next-line
      this?.emit('change', { chain: { id: chainID, unsupported: false } })
      this.provider?.emit('chainChanged', chainId)
    })

    provider.onAccountsChanged((accounts: string[]) => {
      this.onAccountsChanged(accounts)
    })

    provider.onDisconnect(() => {
      this.onDisconnect()
    })

    this.connected = true

    return {
      account,
      chain: {
        id: chainId,
        unsupported: this.isChainUnsupported(chainId),
      },
    }
  }

  async getWalletClient({ chainId }: { chainId?: number } = {}): Promise<any> {
    const [provider, account] = await Promise.all([
      this.getProvider(),
      this.getAccount(),
    ])

    const chain = this.chains.find((x) => x.id === chainId)

    if (!provider) throw new Error('provider is required.')
    return createWalletClient({
      account,
      chain,
      transport: custom(provider),
    })
  }

  async disconnect() {
    if (!this.wallet) {
      this.wallet = await sequence.initWallet()
    }
    this.wallet.disconnect()
  }

  async getAccount() {
    if (!this.wallet) {
      this.wallet = await sequence.initWallet()
    }
    return this.wallet.getAddress() as Promise<`0x${string}`>
  }

  async getChainId() {
    return this.chainId.get()
  }

  async getProvider() {
    if (!this.wallet) {
      this.wallet = await sequence.initWallet()
    }

    if (!this.provider) {
      this.provider = new SwitchingProvider(this.wallet)
    }

    return this.provider
  }

  async getSigner() {
    if (!this.wallet) {
      this.wallet = await sequence.initWallet()
    }

    if (!this.signer) {
      this.signer = new SwitchingSigner(this.wallet, this.provider!)
    }

    return this.signer
  }

  async isAuthorized() {
    try {
      const account = await this.getAccount()
      return !!account
    } catch {
      return false
    }
  }

  async switchChain(chainId: number): Promise<Chain> {
    if (this.isChainUnsupported(chainId)) {
      throw new Error('Unsupported chain')
    }

    this.chainId.set(chainId)

    return { id: chainId } as Chain
  }

  protected onChainChanged(chain: string | number): void {
    this.chainId.set(normalizeChainId(chain))
  }

  protected onAccountsChanged = (accounts: string[]) => {
    return { account: accounts[0] }
  }

  protected onDisconnect = () => {
    // @ts-ignore-next-line
    this?.emit('disconnect')
  }

  isChainUnsupported(chainId: number): boolean {
    return sequence.network.allNetworks.findIndex((x) => x.chainId === chainId) === -1
  }
}

export class SwitchingSigner extends ethers.Signer {
  _memoChainId: number
  _memoSigner: sequence.provider.Web3Signer

  constructor(private sequence: Wallet, public provider: SwitchingProvider) {
    super()

    const chainId = SharedChainID.get()
    this._memoChainId = chainId
    this._memoSigner = this.sequence.getSigner(chainId)!
  }

  private updateMemo(chainId: number) {
    this._memoChainId = chainId
    this._memoSigner = this.sequence.getSigner(chainId)!
  }

  private getSigner(chainId: number): sequence.provider.Web3Signer {
    if (this._memoChainId !== chainId) {
      this.updateMemo(chainId)
    }

    return this._memoSigner
  }

  getAddress(): Promise<string> {
    return this.getSigner(SharedChainID.get()).getAddress()
  }

  signMessage(message: string | ethers.utils.Bytes): Promise<string> {
    return this.getSigner(SharedChainID.get()).signMessage(message, undefined, SharedEIP6492Status.enabled)
  }

  signTransaction(transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>): Promise<string> {
    return this.getSigner(SharedChainID.get()).signTransaction(transaction)
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    return this.getSigner(SharedChainID.get()).connect(provider)
  }

  sendTransaction(transaction: ethers.utils.Deferrable<any>): Promise<any> {
    return this.getSigner(SharedChainID.get()).sendTransaction(transaction)
  }

  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>
  ): Promise<string> {
    return this.getSigner(SharedChainID.get()).signTypedData(domain, types, message, undefined, SharedEIP6492Status.enabled)
  }
}

export class SwitchingProvider extends ethers.providers.BaseProvider {
  _memoChainId: number
  _memoProvider: sequence.provider.Web3Provider

  private _onAccountsChanged: ((accounts: string[]) => void) | null = null
  private _onDisconnect: (() => void) | null = null

  constructor (private sequence: Wallet) {
    super(SharedChainID.get())

    const chainId = SharedChainID.get()
    this._memoChainId = chainId
    this._memoProvider = this.sequence.getProvider(chainId)!

    this.getPovider(chainId).on("accountsChanged", (accounts: string[]) => {
      if (this._onAccountsChanged) {
        this._onAccountsChanged(accounts)
      }
    })

    this.getPovider(chainId).on('disconnect', () => {
      if (this._onDisconnect) {
        this._onDisconnect()
      }
    })
  }

  onAccountsChanged (cb: (accounts: string[]) => void) {
    this._onAccountsChanged = cb
  }

  onDisconnect (cb: () => void) {
    this._onDisconnect = cb
  }

  private updateMemo(chainId: number) {
    this._memoChainId = chainId
    this._memoProvider = this.sequence.getProvider(chainId)!
  }

  private getPovider(chainId: number): sequence.provider.Web3Provider {
    if (this._memoChainId !== chainId) {
      this.updateMemo(chainId)
    }

    return this._memoProvider
  }

  async request(request: { method: string, params: any }): Promise<any> {
    const { method, params } = request
    return this.perform(method, params)
  }

  async perform(method: string, params: any): Promise<any> {
    if (method === 'wallet_switchEthereumChain') {
      const args = params[0] as { chainId: string } | number | string
      const chainId = normalizeChainId(args)
      SharedChainID.set(chainId)
      return { result: { chainId: chainId.toString(16) } }
    }

    if (method === 'eth_chainId') {
      return SharedChainID.get()
    }

    if (SharedEIP6492Status.enabled) {
      if (method === 'personal_sign') {
        method = 'sequence_sign'
      }

      if (method === 'eth_signTypedData_v4' || method === 'eth_signTypedData') {
        method = 'sequence_signTypedData'
      }
    }

    const provider = this.getPovider(SharedChainID.get())
    if (method.startsWith('eth_') || method.startsWith('sequence_') || method.startsWith('personal_')) {
      return provider.send(method, params)
    }

    return provider.send(`eth_${method}`, params)
  }

  send (method: string, params: any): Promise<any> {
    return this.perform(method, params)
  }

  async detectNetwork(): Promise<ethers.providers.Network> {
    const network = sequence.network.allNetworks.find((n) => n.chainId === SharedChainID.get())
    return {
      name: network?.name ?? 'Unknown network',
      chainId: SharedChainID.get()
    }
  }
}


function normalizeChainId(chainId: string | number | bigint | { chainId: string }) {
  if (typeof chainId === 'object') return normalizeChainId(chainId.chainId)
  if (typeof chainId === 'string') return Number.parseInt(chainId, chainId.trim().substring(0, 2) === '0x' ? 16 : 10)
  if (typeof chainId === 'bigint') return Number(chainId)
  return chainId
}
