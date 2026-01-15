export type NodeType =
  | 'section'
  | 'container'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'list'
  | 'card'
  | 'columns2'
  | 'hero';

export interface PageNode {
  id: string;
  type: NodeType;
  children?: PageNode[];
  content?: {
    text?: string;
    tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
    src?: string;
    alt?: string;
    href?: string;
    target?: '_self' | '_blank';
  };
  styles: {
    default: Record<string, string>;
    hover?: Record<string, string>;
  };
  meta?: { name?: string; locked?: boolean };
}

export interface PageDocument {
  id: string;
  name: string;
  root: PageNode;
  settings: {
    primaryFont: string;
    secondaryFont: string;
    baseTextColor: string;
    baseBg: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ProjectData {
  id: string;
  name: string;
  pages: PageDocument[];
  createdAt: number;
  updatedAt: number;
}
