export const formatDate = (date: string | number | Date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString()
}

export const getVal = (v: any) => {
    if (v && typeof v === 'object' && v.$numberDecimal) return v.$numberDecimal
    return v
}

export const cleanSymbol = (symbol: string) => {
    return symbol?.replace('_', '') || symbol
}

export const formatUSD = (amount: number) => {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export const formatBalance = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
}
