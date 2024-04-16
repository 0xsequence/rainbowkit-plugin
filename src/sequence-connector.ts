import { sequence } from '0xsequence'
import { UserRejectedRequestError, getAddress } from 'viem'
import { createConnector } from 'wagmi'

interface SequenceConnectorParameters {
  defaultNetwork?: sequence.network.ChainIdLike
  connectOptions?: sequence.provider.ConnectOptions
  walletAppURL?: string
  useEIP6492?: boolean
  onConnect?: (connectDetails: sequence.provider.ConnectDetails) => void
}

sequenceConnector.type = 'sequenceWallet' as const

export function sequenceConnector(
  parameters: SequenceConnectorParameters = {}
) {
  let walletProvider: sequence.provider.SequenceProvider | undefined

  return createConnector<sequence.provider.SequenceProvider>(config => ({
    id: 'sequence',
    name: 'Sequence Wallet',
    type: sequenceConnector.type,

    async setup() {
      const provider = await this.getProvider()
    },

    async connect() {
      const { connectOptions } = parameters
      const provider = await this.getProvider()

      if (!provider.isConnected()) {
        const res = await provider.connect(
          connectOptions ?? { app: 'RainbowKit app' }
        )

        if (res.error) {
          throw new UserRejectedRequestError(new Error(res.error))
        }

        if (!res.connected) {
          throw new UserRejectedRequestError(
            new Error('Wallet connection rejected')
          )
        }
      }

      const accounts = await this.getAccounts()
      const chainId = await this.getChainId()

      return { accounts, chainId }
    },

    async disconnect() {
      const provider = await this.getProvider()

      return provider.disconnect()
    },

    async getAccounts() {
      const provider = await this.getProvider()
      const address = getAddress(await provider.getSigner().getAddress())

      return [address]
    },

    async getChainId() {
      const provider = await this.getProvider()

      return Number(provider.getChainId())
    },

    async getProvider() {
      if (!walletProvider) {
        const {
          connectOptions,
          defaultNetwork,
          useEIP6492,
          walletAppURL,
          onConnect,
        } = parameters

        const { initWallet } = await import('0xsequence')

        walletProvider = initWallet(connectOptions?.projectAccessKey || '', {
          defaultNetwork,
          transports: walletAppURL
            ? {
                walletAppURL,
              }
            : undefined,
          defaultEIP6492: useEIP6492,
        })

        walletProvider.client.onConnect(connectDetails => {
          this.onConnect?.({ chainId: connectDetails.chainId! })
          onConnect?.(connectDetails)
        })
        walletProvider.on('chainChanged', this.onChainChanged.bind(this))
        walletProvider.on('accountsChanged', this.onAccountsChanged.bind(this))
        walletProvider.on('disconnect', this.onDisconnect.bind(this))
      }

      return walletProvider
    },

    async isAuthorized() {
      try {
        const accounts = await this.getAccounts()

        return !!accounts.length
      } catch {
        return false
      }
    },

    async switchChain({ chainId }) {
      const provider = await this.getProvider()

      if (!isChainSupported(provider, chainId)) {
        throw new Error('Unsupported chain')
      }

      provider.setDefaultChainId(chainId)

      const chain = config.chains.find(chain => chain.id === chainId)

      if (!chain) {
        throw new Error('Chain not found')
      }

      return chain
    },

    async onAccountsChanged(accounts) {
      config.emitter.emit('change', {
        accounts: accounts.map(address => getAddress(address)),
      })
    },

    async onChainChanged(chainId) {
      const provider = await this.getProvider()

      provider.setDefaultChainId(chainId)
      config.emitter.emit('change', { chainId: Number(chainId) })
    },

    async onConnect(providerConnnectInfo) {
      const accounts = await this.getAccounts()

      config.emitter.emit('connect', {
        accounts,
        chainId: Number(providerConnnectInfo.chainId),
      })
    },

    async onDisconnect() {
      config.emitter.emit('disconnect')
    },

    async onMessage() {},
  }))
}

const isChainSupported = (
  provider: sequence.provider.SequenceProvider,
  chainId: number
) => {
  return provider.networks.findIndex(x => x.chainId === chainId) === -1
}
