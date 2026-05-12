export type RowModel = {
  id: string;
  board_id: string;
  title: string;
  color: string | null;
  position: number;
  collapsed: boolean;
};

export type ColumnModel = {
  id: string;
  board_id: string;
  title: string;
  color: string | null;
  position: number;
  wip_limit: number | null;
};

export type CardModel = {
  id: string;
  board_id: string;
  row_id: string;
  column_id: string;
  title: string;
  position: number;
};
