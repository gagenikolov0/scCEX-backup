import { memo } from 'react'
import { Box, Table, Text } from '@mantine/core'
import { TableVirtuoso } from 'react-virtuoso'

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
    minWidth?: string | number
}

const DataTable = memo(({ data, columns, emptyMessage, maxHeight = '430px', minWidth = '800px' }: DataTableProps) => {
    return (
        <Box style={{ height: maxHeight, display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
            <TableVirtuoso
                style={{ height: '100%' }}
                data={data}
                fixedHeaderContent={() => (
                    <Table.Tr bg="var(--bg-1)" style={{ boxShadow: '0 1px 0 var(--mantine-color-default-border)' }}>
                        {columns.map((col) => {
                            const label = typeof col === 'string' ? col : col.label
                            return (
                                <Table.Th key={label} c="dimmed" fw={600} py={12} style={{ whiteSpace: 'nowrap', border: 'none' }}>
                                    {label}
                                </Table.Th>
                            )
                        })}
                    </Table.Tr>
                )}
                itemContent={(_index, item) => (
                    <>
                        {columns.map((col) => {
                            const key = typeof col === 'string' ? col : col.key
                            const label = typeof col === 'string' ? col : col.label

                            if (typeof col !== 'string' && col.render) {
                                return <Table.Td key={label} py={12} style={{ border: 'none' }}>{col.render(item)}</Table.Td>
                            }
                            return <Table.Td key={label} py={12} style={{ border: 'none' }}>{item[key] ?? '-'}</Table.Td>
                        })}
                    </>
                )}
                components={{
                    Table: (props) => <Table {...props} style={{ minWidth, tableLayout: 'fixed' }} verticalSpacing="xs" horizontalSpacing={8} highlightOnHover fs="sm" withRowBorders={false} />,
                    EmptyPlaceholder: () => (
                        <Table.Tbody>
                            <Table.Tr>
                                <Table.Td colSpan={columns.length} style={{ border: 'none' }}>
                                    <Box py={40} ta="center">
                                        <Text c="dimmed" size="sm">{emptyMessage}</Text>
                                    </Box>
                                </Table.Td>
                            </Table.Tr>
                        </Table.Tbody>
                    ),
                }}
            />
        </Box>
    )
})

export default DataTable
