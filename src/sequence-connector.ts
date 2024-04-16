import { sequence } from '0xsequence'
import { getAddress } from 'viem'
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
  const { defaultNetwork, connectOptions, walletAppURL, useEIP6492 } =
    parameters

  let walletProvider: sequence.provider.SequenceProvider | undefined

  return createConnector<sequence.provider.SequenceProvider>(config => ({
    id: 'sequence',
    name: 'Sequence Wallet',
    type: sequenceConnector.type,

    async setup() {
      const provider = await this.getProvider()
    },

    async connect(parameters) {
      const provider = await this.getProvider()
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
        const { initWallet } = await import('0xsequence')

        const projectAccessKey = connectOptions?.projectAccessKey || ''

        walletProvider = initWallet(projectAccessKey, {
          defaultNetwork,
          transports: walletAppURL
            ? {
                walletAppURL,
              }
            : undefined,
          defaultEIP6492: useEIP6492,
        })
      }

      return walletProvider
    },

    async isAuthorized() {
      try {
        const accounts = await this.getAccounts()

        return !!accounts[0]
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

    async onConnect() {
      const accounts = await this.getAccounts()
      const chainId = await this.getChainId()

      config.emitter.emit('connect', { accounts, chainId })
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

// export class SequenceConnector extends Connector<
//   sequence.SequenceProvider,
//   Options | undefined
// > {
//   id = 'sequence'
//   name = 'Sequence'
//   ready = true

//   provider: sequence.SequenceProvider

//   constructor({
//     chains,
//     options,
//     defaultNetwork,
//     projectAccessKey,
//   }: {
//     defaultNetwork?: sequence.network.ChainIdLike
//     chains?: Chain[]
//     options?: Options
//     projectAccessKey: string
//   }) {
//     super({ chains, options })

//     this.provider = sequence.initWallet(projectAccessKey, {
//       defaultNetwork,
//       transports: options?.walletAppURL
//         ? {
//             walletAppURL: options.walletAppURL,
//           }
//         : undefined,
//       defaultEIP6492: options?.useEIP6492,
//     })

//     if (options?.onConnect) {
//       this.provider.client.onConnect(connectDetails => {
//         options.onConnect?.(connectDetails)
//       })
//     }

//     this.provider.on('chainChanged', (chainIdHex: string) => {
//       // @ts-ignore-next-line
//       this?.emit('change', {
//         chain: { id: normalizeChainId(chainIdHex), unsupported: false },
//       })
//     })

//     this.provider.on('accountsChanged', (accounts: string[]) => {
//       // @ts-ignore-next-line
//       this?.emit('accountsChanged', this.onAccountsChanged(accounts))
//     })

//     this.provider.on('disconnect', () => {
//       this.onDisconnect()
//     })
//   }

//   async connect(): Promise<Required<ConnectorData>> {
//     if (!this.provider.isConnected()) {
//       // @ts-ignore-next-line
//       this?.emit('message', { type: 'connecting' })
//       const e = await this.provider.connect(
//         this.options?.connect ?? { app: 'RainbowKit app' }
//       )
//       if (e.error) {
//         throw new UserRejectedRequestError(new Error(e.error))
//       }
//       if (!e.connected) {
//         throw new UserRejectedRequestError(
//           new Error('Wallet connection rejected')
//         )
//       }
//     }

//     const account = await this.getAccount()

//     return {
//       account,
//       chain: {
//         id: this.provider.getChainId(),
//         unsupported: this.isChainUnsupported(this.provider.getChainId()),
//       },
//     }
//   }
// }
