import { sequence } from '0xsequence'
import { Chain } from '@rainbow-me/rainbowkit'

import {
  createWalletClient,
  custom,
  UserRejectedRequestError
} from 'viem'

import { Connector, ConnectorData, ConnectorNotFoundError, WalletClient } from 'wagmi'

interface Options {
  connect?: sequence.provider.ConnectOptions
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

export class SequenceConnector extends Connector<sequence.provider.Web3Provider, Options | undefined> {
  id = 'sequence'
  name = 'Sequence'
  ready = true
  provider: sequence.provider.Web3Provider | null = null
  wallet?: sequence.provider.Wallet
  connected = false

  // NOTICE: The chainId is a singleton
  // this is because rainbowkit expects the whole wallet to switch networks
  // at once, and we can't avoid rainbowkit from creating multiple connectors
  // so we mimic the same behavior here.
  chainId = SharedChainID

  constructor({ chains, options }: { chains?: Chain[]; options?: Options }) {
    super({ chains, options })

    if (this.chainId.get() === undefined) {
      this.chainId.set(chains?.[0]?.id || 1)
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

    provider.on("accountsChanged", this.onAccountsChanged)
    provider.on('disconnect', this.onDisconnect)

    this.connected = true

    return {
      account,
      chain: {
        id: chainId,
        unsupported: this.isChainUnsupported(chainId),
      },
    }
  }

  async getWalletClient({ chainId }: { chainId?: number } = {}): Promise<WalletClient> {
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
      const provider = this.wallet.getProvider()
      if (!provider) {
        throw new ConnectorNotFoundError('Failed to get Sequence Wallet provider.')
      }
      this.provider = this.patchProvider(provider)
    }

    return this.provider
  }

  async getSigner() {
    if (!this.wallet) {
      this.wallet = await sequence.initWallet()
    }
    return this.wallet.getSigner()
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

  /**
   * This patches the Sequence provider to add support for switching chains
   * we do this by replacing the send/sendAsync methods with our own methods
   * that intercept `wallet_switchEthereumChain` requests, and forwards everything else.
   * 
   * NOTICE: This is a temporary solution until Sequence Wallet supports switching chains
   * directly from the provider.
   * 
   */
  private patchProvider(provider: sequence.provider.Web3Provider) {
    // Capture send/sendAsync, replace them with our own
    // the only difference is that we capture wallet_switchEthereumChain
    // and call our own switchChain method
    const send = provider.send.bind(provider)
    const sendAsync = provider.sendAsync.bind(provider)
    const switchChain = this.switchChain.bind(this) as (chainId: number) => Promise<Chain>

    const altSend = async (
      method: string,
      params: any[] | undefined,
      _chainId?: number
    ): Promise<{ cont: true } | { cont: false, res: any }> => {
      if (method === 'wallet_switchEthereumChain') {
        if (!params) throw new Error('Missing params')
        const args = params[0] as { chainId: string } | number | string
        return { cont: false, res: switchChain(normalizeChainId(args)) }
      }

      if (method === 'eth_chainId') {
        return { cont: false, res: this.chainId.get() }
      }

      // Use sequence signing methods instead for 6492 support
      // but only if the signing account is suffixed with :EIP6492 (utils.usingEIP6492)
      if (method === 'personal_sign' || method === 'eth_signTypedData') {
        if (!params) throw new Error('Missing params')
        const { EIP6492 } = usesEIP6492Account(params[0])
        if (EIP6492) {
          // Only override the method if the account is suffixed with :EIP6492
          // otherwise default to the original behavior
          method = method === 'personal_sign' ? 'sequence_sign' : 'sequence_signTypedData_v4'
        }
      }
      return { cont: true }
    }

    provider.send = async (method: string, params: any[], _chainId?: number) => {
      const altRes = await altSend(method, params, _chainId)
  
      if (!altRes.cont) {
        return altRes.res
      }
  
      return send(method, params, this.chainId.get())
    }

    provider.sendAsync = (
      request: sequence.network.JsonRpcRequest,
      callback: sequence.network.JsonRpcResponseCallback | ((error: any, response: any) => void),
      _chainId?: number
    ) => {
      altSend(request.method, request.params, _chainId).then((altRes) => {
        if (!altRes.cont) {
          return callback(null, { result: altRes.res })
        } else {
          return sendAsync(request, callback, this.chainId.get())
        }
      }).catch((err) => {
        callback(err, null)
      })
    }

    return provider
  }
}


function normalizeChainId(chainId: string | number | bigint | { chainId: string }) {
  if (typeof chainId === 'object') return normalizeChainId(chainId.chainId)
  if (typeof chainId === 'string') return Number.parseInt(chainId, chainId.trim().substring(0, 2) === '0x' ? 16 : 10)
  if (typeof chainId === 'bigint') return Number(chainId)
  return chainId
}
