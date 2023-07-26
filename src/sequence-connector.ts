import { sequence } from '0xsequence'
import { Chain } from '@rainbow-me/rainbowkit'

import { createWalletClient, custom, UserRejectedRequestError } from 'viem'

import { Connector, ConnectorData } from 'wagmi'

interface Options {
  connect?: sequence.provider.ConnectOptions
  walletAppURL?: string
}

export class SequenceConnector extends Connector<sequence.SequenceProvider, Options | undefined> {
  id = 'sequence'
  name = 'Sequence'
  ready = true

  provider: sequence.SequenceProvider

  constructor({
    chains,
    options,
    defaultNetwork,
  }: {
    defaultNetwork?: sequence.network.ChainIdLike
    chains?: Chain[]
    options?: Options
  }) {
    super({ chains, options })

    this.provider = sequence.initWallet({
      defaultNetwork,
      transports: {
        walletAppURL: options?.walletAppURL,
      },
    })

    // this.provider.on('chainChanged', (chainID: number) => {
    this.provider.client.onDefaultChainIdChanged((chainID: number) => {
      // @ts-ignore-next-line
      this?.emit('change', { chain: { id: chainID, unsupported: false } })
      this.provider?.emit('chainChanged', chainID)
    })

    this.provider.on('accountsChanged', (accounts: string[]) => {
      this.onAccountsChanged(accounts)
    })

    // TODO: Add onDisconnect
    // provider.onDisconnect(() => {
    //   this.onDisconnect()
    // })
  }

  async connect(): Promise<Required<ConnectorData>> {
    if (!this.provider.isConnected()) {
      // @ts-ignore-next-line
      this?.emit('message', { type: 'connecting' })
      const e = await this.provider.connect(this.options?.connect ?? { app: 'RainbowKit app' })
      if (e.error) {
        throw new UserRejectedRequestError(new Error(e.error))
      }
      if (!e.connected) {
        throw new UserRejectedRequestError(new Error('Wallet connection rejected'))
      }
    }

    const account = await this.getAccount()

    return {
      account,
      chain: {
        id: this.provider.getChainId(),
        unsupported: this.isChainUnsupported(this.provider.getChainId()),
      },
    }
  }

  async getWalletClient({ chainId }: { chainId?: number } = {}): Promise<any> {
    const chain = this.chains.find((x) => x.id === chainId)

    return createWalletClient({
      chain,
      account: await this.getAccount(),
      transport: custom(this.provider),
    })
  }

  protected onChainChanged(chain: string | number): void {
    this.provider.setDefaultChainId(chain as number)
  }

  async switchChain(chainId: number): Promise<Chain> {
    if (this.isChainUnsupported(chainId)) {
      throw new Error('Unsupported chain')
    }

    this.provider.setDefaultChainId(chainId)
    return this.chains.find((x) => x.id === chainId) as Chain
  }

  async disconnect() {
    this.provider.disconnect()
  }

  getAccount() {
    return this.provider.getSigner().getAddress() as Promise<`0x${string}`>
  }

  async getChainId() {
    return this.provider.getChainId()
  }

  async getProvider() {
    return this.provider
  }

  async getSigner() {
    return this.provider.getSigner()
  }

  async isAuthorized() {
    try {
      const account = await this.getAccount()
      return !!account
    } catch {
      return false
    }
  }

  protected onAccountsChanged = (accounts: string[]) => {
    return { account: accounts[0] }
  }

  protected onDisconnect = () => {
    // @ts-ignore-next-line
    this?.emit('disconnect')
  }

  isChainUnsupported(chainId: number): boolean {
    return this.provider.networks.findIndex((x) => x.chainId === chainId) === -1
  }
}
