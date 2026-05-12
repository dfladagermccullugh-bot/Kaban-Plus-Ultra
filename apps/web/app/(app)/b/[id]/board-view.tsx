'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { positionBetween, sortByPosition } from '@kpu/core';
import { cn } from '@kpu/ui';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  createCard,
  createColumn,
  createRow,
  deleteCard,
  deleteColumn,
  deleteRow,
  moveCard,
  moveColumn,
  moveRow,
  renameCard,
  renameColumn,
  renameRow,
} from './actions';
import { CardItem } from './card-item';
import { ColumnHeader } from './column-header';
import { RowHeader } from './row-header';
import type { CardModel, ColumnModel, RowModel } from './types';

type Props = {
  boardId: string;
  initialRows: RowModel[];
  initialColumns: ColumnModel[];
  initialCards: CardModel[];
};

type DropTarget =
  | { kind: 'cell'; rowId: string; columnId: string }
  | { kind: 'card'; cardId: string };

function parseDroppableId(id: string): DropTarget | null {
  if (id.startsWith('cell:')) {
    const [, rowId, columnId] = id.split(':');
    if (rowId && columnId) return { kind: 'cell', rowId, columnId };
  }
  if (id.startsWith('card:')) {
    const [, cardId] = id.split(':');
    if (cardId) return { kind: 'card', cardId };
  }
  return null;
}

export function BoardView({ boardId, initialRows, initialColumns, initialCards }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RowModel[]>(initialRows);
  const [columns, setColumns] = useState<ColumnModel[]>(initialColumns);
  const [cards, setCards] = useState<CardModel[]>(initialCards);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const sortedRows = useMemo(() => sortByPosition(rows), [rows]);
  const sortedColumns = useMemo(() => sortByPosition(columns), [columns]);

  const cardsByCell = useMemo(() => {
    const map = new Map<string, CardModel[]>();
    for (const c of cards) {
      const key = `${c.row_id}:${c.column_id}`;
      const arr = map.get(key);
      if (arr) arr.push(c);
      else map.set(key, [c]);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [cards]);

  const moveCardMutation = useMutation({
    mutationFn: async (input: {
      cardId: string;
      rowId: string;
      columnId: string;
      position: number;
    }) => {
      const result = await moveCard({ boardId, ...input });
      if (!result.ok) throw new Error(result.error);
    },
    onError: () => {
      router.refresh();
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith('card:')) setActiveCardId(id.slice('card:'.length));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    if (!event.over) return;
    const activeId = String(event.active.id);
    if (!activeId.startsWith('card:')) return;
    const cardId = activeId.slice('card:'.length);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const target = parseDroppableId(String(event.over.id));
    if (!target) return;

    let nextRowId: string;
    let nextColumnId: string;
    let nextPosition: number;

    if (target.kind === 'cell') {
      nextRowId = target.rowId;
      nextColumnId = target.columnId;
      const cell = cardsByCell.get(`${nextRowId}:${nextColumnId}`) ?? [];
      const filtered = cell.filter((c) => c.id !== cardId);
      const last = filtered[filtered.length - 1];
      nextPosition = positionBetween(last?.position ?? null, null);
    } else {
      const overCard = cards.find((c) => c.id === target.cardId);
      if (!overCard || overCard.id === cardId) return;
      nextRowId = overCard.row_id;
      nextColumnId = overCard.column_id;
      const cell = cardsByCell.get(`${nextRowId}:${nextColumnId}`) ?? [];
      const idx = cell.findIndex((c) => c.id === overCard.id);
      const prevCard = (() => {
        for (let i = idx - 1; i >= 0; i--) {
          const c = cell[i];
          if (c && c.id !== cardId) return c;
        }
        return undefined;
      })();
      nextPosition = positionBetween(prevCard?.position ?? null, overCard.position);
    }

    if (
      card.row_id === nextRowId &&
      card.column_id === nextColumnId &&
      card.position === nextPosition
    ) {
      return;
    }

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, row_id: nextRowId, column_id: nextColumnId, position: nextPosition }
          : c,
      ),
    );
    moveCardMutation.mutate({
      cardId,
      rowId: nextRowId,
      columnId: nextColumnId,
      position: nextPosition,
    });
  }

  // ─── Card create/rename/delete ──────────────────────────────────────────

  async function handleCreateCard(rowId: string, columnId: string, title: string) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const cell = cardsByCell.get(`${rowId}:${columnId}`) ?? [];
    const last = cell[cell.length - 1];
    const position = positionBetween(last?.position ?? null, null);
    setCards((prev) => [
      ...prev,
      { id: tempId, board_id: boardId, row_id: rowId, column_id: columnId, title, position },
    ]);
    const result = await createCard({ boardId, rowId, columnId, title });
    if (result.ok) {
      setCards((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: result.data.id } : c)));
      router.refresh();
    } else {
      setCards((prev) => prev.filter((c) => c.id !== tempId));
    }
  }

  function handleRenameCard(cardId: string, title: string) {
    const original = cards.find((c) => c.id === cardId);
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, title } : c)));
    startTransition(async () => {
      const result = await renameCard(boardId, cardId, title);
      if (!result.ok && original) {
        setCards((prev) => prev.map((c) => (c.id === cardId ? original : c)));
      }
    });
  }

  function handleDeleteCard(cardId: string) {
    const removed = cards.find((c) => c.id === cardId);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    startTransition(async () => {
      const result = await deleteCard(boardId, cardId);
      if (!result.ok && removed) setCards((prev) => [...prev, removed]);
    });
  }

  // ─── Row CRUD ───────────────────────────────────────────────────────────

  async function handleAddRow() {
    const title = 'New row';
    const tempId = `temp-${crypto.randomUUID()}`;
    const last = sortedRows[sortedRows.length - 1];
    const position = positionBetween(last?.position ?? null, null);
    setRows((prev) => [
      ...prev,
      { id: tempId, board_id: boardId, title, color: 'slate', position, collapsed: false },
    ]);
    const result = await createRow(boardId, title);
    if (result.ok) {
      setRows((prev) => prev.map((r) => (r.id === tempId ? { ...r, id: result.data.id } : r)));
      router.refresh();
    } else {
      setRows((prev) => prev.filter((r) => r.id !== tempId));
    }
  }

  function handleRenameRow(rowId: string, title: string) {
    const original = rows.find((r) => r.id === rowId);
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, title } : r)));
    startTransition(async () => {
      const result = await renameRow(boardId, rowId, title);
      if (!result.ok && original)
        setRows((prev) => prev.map((r) => (r.id === rowId ? original : r)));
    });
  }

  function handleDeleteRow(rowId: string) {
    if (sortedRows.length <= 1) return;
    const removed = rows.find((r) => r.id === rowId);
    const removedCards = cards.filter((c) => c.row_id === rowId);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setCards((prev) => prev.filter((c) => c.row_id !== rowId));
    startTransition(async () => {
      const result = await deleteRow(boardId, rowId);
      if (!result.ok && removed) {
        setRows((prev) => [...prev, removed]);
        setCards((prev) => [...prev, ...removedCards]);
      }
    });
  }

  function handleMoveRow(rowId: string, direction: -1 | 1) {
    const idx = sortedRows.findIndex((r) => r.id === rowId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sortedRows.length) return;
    const before = direction === -1 ? sortedRows[targetIdx - 1] : sortedRows[targetIdx];
    const after = direction === -1 ? sortedRows[targetIdx] : sortedRows[targetIdx + 1];
    const nextPosition = positionBetween(before?.position ?? null, after?.position ?? null);
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, position: nextPosition } : r)));
    startTransition(async () => {
      await moveRow(boardId, rowId, nextPosition);
    });
  }

  // ─── Column CRUD ────────────────────────────────────────────────────────

  async function handleAddColumn() {
    const title = 'New column';
    const tempId = `temp-${crypto.randomUUID()}`;
    const last = sortedColumns[sortedColumns.length - 1];
    const position = positionBetween(last?.position ?? null, null);
    setColumns((prev) => [
      ...prev,
      { id: tempId, board_id: boardId, title, color: 'indigo', position, wip_limit: null },
    ]);
    const result = await createColumn(boardId, title);
    if (result.ok) {
      setColumns((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: result.data.id } : c)));
      router.refresh();
    } else {
      setColumns((prev) => prev.filter((c) => c.id !== tempId));
    }
  }

  function handleRenameColumn(columnId: string, title: string) {
    const original = columns.find((c) => c.id === columnId);
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, title } : c)));
    startTransition(async () => {
      const result = await renameColumn(boardId, columnId, title);
      if (!result.ok && original) {
        setColumns((prev) => prev.map((c) => (c.id === columnId ? original : c)));
      }
    });
  }

  function handleDeleteColumn(columnId: string) {
    if (sortedColumns.length <= 1) return;
    const removed = columns.find((c) => c.id === columnId);
    const removedCards = cards.filter((c) => c.column_id === columnId);
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setCards((prev) => prev.filter((c) => c.column_id !== columnId));
    startTransition(async () => {
      const result = await deleteColumn(boardId, columnId);
      if (!result.ok && removed) {
        setColumns((prev) => [...prev, removed]);
        setCards((prev) => [...prev, ...removedCards]);
      }
    });
  }

  function handleMoveColumn(columnId: string, direction: -1 | 1) {
    const idx = sortedColumns.findIndex((c) => c.id === columnId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sortedColumns.length) return;
    const before = direction === -1 ? sortedColumns[targetIdx - 1] : sortedColumns[targetIdx];
    const after = direction === -1 ? sortedColumns[targetIdx] : sortedColumns[targetIdx + 1];
    const nextPosition = positionBetween(before?.position ?? null, after?.position ?? null);
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, position: nextPosition } : c)),
    );
    startTransition(async () => {
      await moveColumn(boardId, columnId, nextPosition);
    });
  }

  const activeCard = activeCardId ? (cards.find((c) => c.id === activeCardId) ?? null) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `12rem repeat(${sortedColumns.length}, minmax(16rem, 1fr)) auto`,
          }}
        >
          {/* Top-left corner */}
          <div className="sticky left-0 top-0 z-20 border-b border-r border-border bg-bg-elevated" />

          {/* Column headers (sticky top) */}
          {sortedColumns.map((column, idx) => (
            <ColumnHeader
              key={column.id}
              column={column}
              isFirst={idx === 0}
              isLast={idx === sortedColumns.length - 1}
              canDelete={sortedColumns.length > 1}
              onRename={(title) => handleRenameColumn(column.id, title)}
              onDelete={() => handleDeleteColumn(column.id)}
              onMove={(direction) => handleMoveColumn(column.id, direction)}
            />
          ))}

          {/* Add-column header */}
          <div className="sticky top-0 z-10 flex items-center justify-start border-b border-border bg-bg-elevated p-2">
            <button
              type="button"
              onClick={handleAddColumn}
              className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs text-text-muted hover:bg-surface hover:text-text"
            >
              + Column
            </button>
          </div>

          {/* Rows */}
          {sortedRows.map((row, rowIdx) => (
            <RowSlice
              key={row.id}
              row={row}
              columns={sortedColumns}
              cards={cardsByCell}
              boardId={boardId}
              isFirst={rowIdx === 0}
              isLast={rowIdx === sortedRows.length - 1}
              canDelete={sortedRows.length > 1}
              onRowRename={(title) => handleRenameRow(row.id, title)}
              onRowDelete={() => handleDeleteRow(row.id)}
              onRowMove={(direction) => handleMoveRow(row.id, direction)}
              onCardCreate={(columnId, title) => handleCreateCard(row.id, columnId, title)}
              onCardRename={handleRenameCard}
              onCardDelete={handleDeleteCard}
            />
          ))}

          {/* Add-row footer */}
          <div className="sticky left-0 z-10 border-r border-t border-border bg-bg-elevated p-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs text-text-muted hover:bg-surface hover:text-text"
            >
              + Row
            </button>
          </div>
          {sortedColumns.map((c) => (
            <div key={`pad-${c.id}`} className="border-t border-border" />
          ))}
          <div className="border-t border-border" />
        </div>
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="rounded-md border border-accent bg-bg-elevated p-3 text-sm shadow-md ring-2 ring-accent/30">
            {activeCard.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type RowSliceProps = {
  row: RowModel;
  columns: ColumnModel[];
  cards: Map<string, CardModel[]>;
  boardId: string;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onRowRename: (title: string) => void;
  onRowDelete: () => void;
  onRowMove: (direction: -1 | 1) => void;
  onCardCreate: (columnId: string, title: string) => void;
  onCardRename: (cardId: string, title: string) => void;
  onCardDelete: (cardId: string) => void;
};

function RowSlice({
  row,
  columns,
  cards,
  isFirst,
  isLast,
  canDelete,
  onRowRename,
  onRowDelete,
  onRowMove,
  onCardCreate,
  onCardRename,
  onCardDelete,
}: RowSliceProps) {
  return (
    <>
      <RowHeader
        row={row}
        isFirst={isFirst}
        isLast={isLast}
        canDelete={canDelete}
        onRename={onRowRename}
        onDelete={onRowDelete}
        onMove={onRowMove}
      />
      {columns.map((column) => (
        <Cell
          key={`${row.id}:${column.id}`}
          rowId={row.id}
          columnId={column.id}
          cards={cards.get(`${row.id}:${column.id}`) ?? []}
          onCardCreate={(title) => onCardCreate(column.id, title)}
          onCardRename={onCardRename}
          onCardDelete={onCardDelete}
        />
      ))}
      <div className="border-b border-border" />
    </>
  );
}

type CellProps = {
  rowId: string;
  columnId: string;
  cards: CardModel[];
  onCardCreate: (title: string) => void;
  onCardRename: (cardId: string, title: string) => void;
  onCardDelete: (cardId: string) => void;
};

function Cell({ rowId, columnId, cards, onCardCreate, onCardRename, onCardDelete }: CellProps) {
  const droppableId = `cell:${rowId}:${columnId}`;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  const [adding, setAdding] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-32 flex-col gap-2 border-b border-r border-border bg-bg p-2 transition-colors',
        isOver && 'bg-accent/5',
      )}
    >
      {cards.map((card) => (
        <DraggableCard
          key={card.id}
          card={card}
          onRename={(title) => onCardRename(card.id, title)}
          onDelete={() => onCardDelete(card.id)}
        />
      ))}
      {adding ? (
        <NewCardInput
          onSubmit={(title) => {
            onCardCreate(title);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-8 items-center justify-center rounded-sm border border-dashed border-border text-xs text-text-muted hover:border-accent hover:text-accent"
        >
          + Card
        </button>
      )}
    </div>
  );
}

function DraggableCard({
  card,
  onRename,
  onDelete,
}: {
  card: CardModel;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const draggableId = `card:${card.id}`;
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
    transform,
  } = useDraggable({
    id: draggableId,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: draggableId });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        'rounded-md border border-border bg-bg-elevated shadow-sm transition-colors',
        isDragging && 'opacity-30',
        isOver && 'ring-2 ring-accent/40',
      )}
    >
      <CardItem
        card={card}
        dragAttributes={attributes}
        dragListeners={listeners}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}

function NewCardInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
        else onCancel();
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const trimmed = value.trim();
          if (trimmed) onSubmit(trimmed);
          else onCancel();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        maxLength={200}
        placeholder="New card title"
        className="w-full rounded-sm border border-border bg-bg-elevated px-2 py-2 text-sm focus-visible:border-accent focus-visible:outline-none"
      />
    </form>
  );
}
