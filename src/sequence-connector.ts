import { sequence } from '0xsequence'
import { Chain } from '@rainbow-me/rainbowkit'

import { createWalletClient, custom, UserRejectedRequestError } from 'viem'

import { Connector, ConnectorData } from 'wagmi'

interface Options {
  connect?: sequence.provider.ConnectOptions
  walletAppURL?: string
  useEIP6492?: boolean
  onConnect?: (connectDetails: sequence.provider.ConnectDetails) => void
}

export class SequenceConnector extends Connector<
  sequence.SequenceProvider,
  Options | undefined
> {
  id = 'sequence'
  name = 'Sequence'
  ready = true

  provider: sequence.SequenceProvider

  constructor({
    chains,
    options,
    defaultNetwork,
    projectAccessKey,
  }: {
    defaultNetwork?: sequence.network.ChainIdLike
    chains?: Chain[]
    options?: Options
    projectAccessKey: string
  }) {
    super({ chains, options })

    this.provider = sequence.initWallet(projectAccessKey, {
      defaultNetwork,
      transports: options?.walletAppURL
        ? {
            walletAppURL: options.walletAppURL,
          }
        : undefined,
      defaultEIP6492: options?.useEIP6492,
    })

    if (options?.onConnect) {
      this.provider.client.onConnect(connectDetails => {
        options.onConnect?.(connectDetails)
      })
    }

    this.provider.on('chainChanged', (chainIdHex: string) => {
      // @ts-ignore-next-line
      this?.emit('change', {
        chain: { id: normalizeChainId(chainIdHex), unsupported: false },
      })
    })

    this.provider.on('accountsChanged', (accounts: string[]) => {
      // @ts-ignore-next-line
      this?.emit('accountsChanged', this.onAccountsChanged(accounts))
    })

    this.provider.on('disconnect', () => {
      this.onDisconnect()
    })
  }

  async connect(): Promise<Required<ConnectorData>> {
    if (!this.provider.isConnected()) {
      // @ts-ignore-next-line
      this?.emit('message', { type: 'connecting' })
      const e = await this.provider.connect(
        this.options?.connect ?? { app: 'RainbowKit app' }
      )
      if (e.error) {
        throw new UserRejectedRequestError(new Error(e.error))
      }
      if (!e.connected) {
        throw new UserRejectedRequestError(
          new Error('Wallet connection rejected')
        )
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
    const chain = this.chains.find(x => x.id === chainId)

    return createWalletClient({
      chain,
      account: await this.getAccount(),
      transport: custom(this.provider),
    })
  }

  protected onChainChanged(chain: string | number): void {
    this.provider.setDefaultChainId(normalizeChainId(chain))
  }

  async switchChain(chainId: number): Promise<Chain> {
    if (this.isChainUnsupported(chainId)) {
      throw new Error('Unsupported chain')
    }

    this.provider.setDefaultChainId(chainId)
    return this.chains.find(x => x.id === chainId) as Chain
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
    return this.provider.networks.findIndex(x => x.chainId === chainId) === -1
  }
}

function normalizeChainId(
  chainId: string | number | bigint | { chainId: string }
) {
  if (typeof chainId === 'object') return normalizeChainId(chainId.chainId)
  if (typeof chainId === 'string')
    return Number.parseInt(
      chainId,
      chainId.trim().substring(0, 2) === '0x' ? 16 : 10
    )
  if (typeof chainId === 'bigint') return Number(chainId)
  return chainId
}
