
export function usingEIP6492(account: `0x${string}`): `0x${string}` {
  return account + `:EIP6492` as `0x${string}`
}

export function usesEIP6492Account(account: `0x${string}`): { EIP6492: boolean, account: `0x${string}` } {
  return { EIP6492: account.endsWith(':EIP6492'), account: account.replace(':EIP6492', '') as `0x${string}` }
}
