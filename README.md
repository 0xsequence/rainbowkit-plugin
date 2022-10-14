# rainbowkit-plugin
Rainbowkit plugin for the [Sequence](https://sequence.xyz/) wallet.

## install

```js
  npm install 0xsequence/rainbowkit-plugin
```

## Params
### chains
Chains supported by app.

### shimDisconnect (optional)
Simulates the disconnect behavior by keeping track of connection status in storage. Defaults to true.

### appName (optional)
Name of the app which will show up in the Sequence popup requesting a connection.

## Example of usage

```js
import { sequenceWallet } from './sequence-wallet'
...other imports

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      sequenceWallet({
        chains,
        shimDisconnect: true,
        appName: 'My Cool Dapp',
      }),
      ...otherRainbowKitWallets
    ]
  }
])

export const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider
})
```

A full demo is available at: https://github.com/0xsequence/demo-dapp-rainbowkit