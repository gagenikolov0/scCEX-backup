import { memo } from 'react'
import { Box, Table } from '@mantine/core'

interface Column {
    label: string
    key: string
    render?: (item: any) => React.ReactNode
}

interface DataTableProps {
    data: any[]
    columns: (string | Column)[]
    emptyMessage: string
    maxHeight?: string | number
}

const DataTable = memo(({ data, columns, emptyMessage, maxHeight = '430px' }: DataTableProps) => {
    return (
        <Box style={{ height: maxHeight, overflowY: 'auto' }}>
            <Box style={{ overflowX: 'auto', flex: 1 }} px="xs">
                <Table verticalSpacing="xs" horizontalSpacing={4} highlightOnHover fs="sm" withRowBorders={false}>
                    <Table.Thead bg="var(--bg-2)" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <Table.Tr>
                            {columns.map((col) => {
                                const label = typeof col === 'string' ? col : col.label
                                return (
                                    <Table.Th key={label} c="dimmed" fw={600} py={10} style={{ whiteSpace: 'nowrap' }}>
                                        {label}
                                    </Table.Th>
                                )
                            })}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody style={{ verticalAlign: 'middle' }}>
                        {data.length === 0 ? (
                            <Table.Tr>
                                <Table.Td py={16} ta="center" c="dimmed" colSpan={columns.length}>
                                    {emptyMessage}
                                </Table.Td>
                            </Table.Tr>
                        ) : (
                            data.map((item, index) => (
                                <Table.Tr key={item.id || item._id || index}>
                                    {columns.map((col) => {
                                        const key = typeof col === 'string' ? col : col.key
                                        const label = typeof col === 'string' ? col : col.label

                                        if (typeof col !== 'string' && col.render) {
                                            return <Table.Td key={label}>{col.render(item)}</Table.Td>
                                        }

                                        // Default rendering logic can be added here if needed, 
                                        // but for now we'll rely on the render prop for complex cells.
                                        return <Table.Td key={label}>{item[key] ?? '-'}</Table.Td>
                                    })}
                                </Table.Tr>
                            ))
                        )}
                    </Table.Tbody>
                </Table>
            </Box>
        </Box>
    )
})

export default DataTable
