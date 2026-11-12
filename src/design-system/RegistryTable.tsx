import { isValidElement, useMemo, useState, type CSSProperties, type HTMLAttributes, type Key, type ReactElement, type ReactNode, type Ref, type TableHTMLAttributes } from 'react'
import { sortRowsBy, type SortState } from './useTableSort'
import { RegistryEmptyState } from './RegistryEmptyState'
import { TableSkeleton } from './LoadingSkeleton'
import type { EmptyStateAction } from './RegistryEmptyState'
import type { IconType } from './types'
import './RegistryTable.css'

export interface RegistryColumn<Row> {
  key?: string
  label?: ReactNode
  className?: string
  style?: CSSProperties
  ariaLabel?: string
  // false: never sortable; true: sortable by a caller that sorts (onSort)
  sortable?: boolean
  // the value the column sorts by (default: row[key])
  sortValue?: (row: Row) => unknown
}

interface RegistryTableProps<Row> {
  columns?: Array<RegistryColumn<Row>>
  rows?: Row[]
  rowKey?: (row: Row, index: number) => Key
  renderRow?: (row: Row, index: number) => ReactNode
  rowProps?: (row: Row, index: number) => HTMLAttributes<HTMLTableRowElement> | null | undefined
  className?: string
  wrapperClassName?: string
  wrapperRef?: Ref<HTMLDivElement>
  tableProps?: TableHTMLAttributes<HTMLTableElement>
  empty?: boolean
  emptyTitle?: ReactNode
  emptyText?: ReactNode
  emptyFiltered?: boolean
  onClearFilters?: () => void
  emptyIcon?: IconType
  emptyAction?: EmptyStateAction | null
  bare?: boolean
  loading?: boolean
  error?: boolean | string | null
  onRetry?: () => void
  sort?: SortState | null
  onSort?: (key: string) => void
  sortable?: boolean
}

// A row's own field, for the default key and sort (rows are records: objects).
const field=(row: unknown,key: string|undefined)=>key==null?undefined:(row as Record<string, unknown> | null | undefined)?.[key]
// What a column sorts by: column.sortValue(row), or row[column.key].
const reader=<Row,>(column: RegistryColumn<Row>)=>column.sortValue||((rowItem: Row)=>field(rowItem,column.key))

// Row: the type of the rows. Its default stays open while the callers are JavaScript (their rows are untyped).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RegistryTable<Row = any>({
  columns=[],
  rows=[],
  rowKey=(row,index)=>(field(row,'id') as Key | null | undefined)??index,
  renderRow,
  rowProps,
  className='',
  wrapperClassName='scroll-table',
  wrapperRef,
  tableProps={},
  empty=false,
  emptyTitle,
  emptyText,
  // A filtered-out list (search / filters) offers «Clear filters»; an empty
  // registry shows emptyIcon and emptyAction ({label, onClick, icon}).
  emptyFiltered=false,
  onClearFilters,
  emptyIcon,
  emptyAction,
  bare=false,
  // loading: the first load has not finished: placeholder lines, never the empty state.
  loading=false,
  // error: the read failed: say so (with «Try again» when onRetry is given), never the empty state.
  error=false,
  onRetry,
  // sort / onSort: a column with sortable:true gets a header button with ▲▼ arrows (see useTableSort).
  sort,
  onSort,
  // sortable={false}: no header arrows (a list the caller pages itself must sort with useTableSort instead).
  sortable=true,
}: RegistryTableProps<Row>){
  const tableClass=`data-table sticky-table ${className}`.trim()
  const hasRows=Array.isArray(rows)&&rows.length>0
  // Without onSort the table sorts its own rows (the whole list): a column sorts by column.sortValue(row), or by row[column.key] when that is plain text, a number or a date.
  const [ownSort,setOwnSort]=useState<SortState>({key:null,dir:'asc'})
  const controlled=typeof onSort==='function'
  const canSort=(column: RegistryColumn<Row>)=>sortable!==false&&column.sortable!==false&&Boolean(column.label)&&column.key!=null&&(controlled?column.sortable===true:(Boolean(column.sortValue)||(hasRows&&rows.length>1&&rows.some(rowItem=>['string','number'].includes(typeof field(rowItem,column.key))))))
  const activeSort=controlled?sort:ownSort
  const shownRows=useMemo(()=>{
    if(controlled||!hasRows||!ownSort.key)return rows
    const column=columns.find(item=>item.key===ownSort.key)
    return column?sortRowsBy(rows,reader(column),ownSort.dir):rows
  },[rows,columns,ownSort,controlled,hasRows])
  const clickSort=controlled?onSort:(key: string)=>setOwnSort(current=>current.key===key?{key,dir:current.dir==='asc'?'desc':'asc'}:{key,dir:'asc'})
  const table=<table className={tableClass} {...tableProps}>
    <thead><tr>{columns.map((column,index)=><th key={column.key??index} className={column.className} style={column.style} aria-label={column.ariaLabel} aria-sort={canSort(column)?(activeSort?.key===column.key?(activeSort?.dir==='desc'?'descending':'ascending'):'none'):undefined}>{canSort(column)?<button type="button" className="registry-sort" onClick={()=>clickSort(column.key as string)}>{column.label}<span className="registry-sort-arrows" aria-hidden="true"><i className={activeSort?.key===column.key&&activeSort?.dir==='asc'?'on':''}>▲</i><i className={activeSort?.key===column.key&&activeSort?.dir==='desc'?'on':''}>▼</i></span></button>:column.label}</th>)}</tr></thead>
    <tbody>{shownRows.map((row,index)=>{
      const supplied=typeof rowProps==='function'?(rowProps(row,index)||{}):{}
      const rendered=renderRow?.(row,index)
      if(isValidElement<{className?: string}>(rendered)&&rendered.type==='tr'){
        const mergedClass=[rendered.props.className,supplied.className].filter(Boolean).join(' ')
        return {...rendered,key:rowKey(row,index),props:{...rendered.props,...supplied,className:mergedClass||undefined}} as ReactElement
      }
      return <tr key={rowKey(row,index)} {...supplied}>{rendered}</tr>
    })}</tbody>
  </table>
  // Only render the built-in empty state when the caller opted in with
  // emptyTitle - otherwise a caller managing its own empty-state UI
  // (a sibling registry-empty-state, a different tab's placeholder, etc.)
  // would end up with an extra, textless box whenever rows is empty.
  const loadingRows=loading&&!hasRows
  const richEmpty=emptyFiltered||Boolean(emptyAction)||Boolean(emptyIcon)
  const emptyState=loadingRows?<TableSkeleton/>:error&&!hasRows?<RegistryEmptyState error={error} onRetry={onRetry}/>:(Boolean(emptyTitle)||richEmpty)&&(!hasRows||empty)&&(richEmpty
    ?<RegistryEmptyState filtered={emptyFiltered} onClearFilters={onClearFilters} title={emptyFiltered?undefined:emptyTitle} text={emptyFiltered?undefined:emptyText} icon={emptyIcon} action={emptyAction}/>
    :<div className="inline-empty" role="status"><strong>{emptyTitle}</strong>{emptyText&&<span>{emptyText}</span>}</div>)
  // bare: caller already owns the scroll wrapper (e.g. one shared wrapper
  // around several conditionally-rendered tables) - render just the table.
  if(bare)return <>{table}{emptyState}</>
  return <div ref={wrapperRef} className={wrapperClassName} data-ui="registry-table">
    {table}
    {emptyState}
  </div>
}
