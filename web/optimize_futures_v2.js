const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/NewAdminUser/OneDrive/Desktop/exch/web/src/routes/Futures.tsx';
console.log('Target file:', filePath);

if (!fs.existsSync(filePath)) {
    console.error('File does not exist!');
    process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. Add statsMap
const accountHookLine = '  const { futuresAvailable, refreshBalances, futuresPositions, orders: recentOrders } = useAccount()';
const statsMapLine = '  const statsMap = useMemo(() => new Map(futuresStats.map(s => [s.symbol, s])), [futuresStats])';

if (content.includes(accountHookLine)) {
    if (!content.includes(statsMapLine)) {
        // Use a more robust replacement that handles line endings
        content = content.replace(accountHookLine, `${accountHookLine}\n${statsMapLine}`);
        console.log('Added statsMap');
    } else {
        console.log('statsMap already exists');
    }
} else {
    console.error('Could not find account hook line!');
}

// 2. Optimize renderTable
const oldPnlLine = 'const itemStats = futuresStats.find(s => s.symbol === item.symbol)';
const newPnlLine = 'const itemStats = statsMap.get(item.symbol)';

if (content.includes(oldPnlLine)) {
    content = content.replace(oldPnlLine, newPnlLine);
    console.log('Optimized renderTable');
} else {
    console.log('Old PNL line not found (maybe already optimized)');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully saved changes to Futures.tsx');
