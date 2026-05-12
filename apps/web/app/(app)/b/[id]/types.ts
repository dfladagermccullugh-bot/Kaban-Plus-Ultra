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
  cover_image_id: string | null;
};

export type LabelModel = {
  id: string;
  board_id: string;
  name: string;
  color: string;
};

export type CardLabelLink = {
  card_id: string;
  label_id: string;
};

export type ImageModel = {
  id: string;
  board_id: string;
  card_id: string | null;
  storage_path: string;
  width: number;
  height: number;
  mime: string;
  blurhash: string;
};
