import { PageDocument, PageNode, NodeType } from '../models/page-schema';

export const STORAGE_KEY = 'page_builder_projects_v1';

export const generateId = (): string =>
  crypto.randomUUID?.() ?? `node-${Math.random().toString(36).slice(2, 10)}`;

export const deepClone = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

export const createDefaultRoot = (): PageNode => ({
  id: generateId(),
  type: 'section',
  children: [],
  content: {},
  styles: {
    default: {
      padding: '40px',
      minHeight: '400px',
      backgroundColor: '#ffffff',
    },
  },
  meta: { name: 'Root Section' },
});

export const createPageDocument = (name: string): PageDocument => {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    root: createDefaultRoot(),
    settings: {
      primaryFont: 'Inter, Segoe UI, sans-serif',
      secondaryFont: 'Georgia, serif',
      baseTextColor: '#1b1f3b',
      baseBg: '#f4f6fb',
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const createNode = (type: NodeType): PageNode => {
  const id = generateId();
  const base: PageNode = {
    id,
    type,
    styles: {
      default: {
        padding: '8px',
      },
    },
  };

  switch (type) {
    case 'header':
      return {
        ...base,
        children: [],
        styles: {
          default: {
            padding: '24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'grid',
            gap: '12px',
          },
        },
        meta: { name: 'Header' },
      };
    case 'footer':
      return {
        ...base,
        children: [],
        styles: {
          default: {
            padding: '24px',
            backgroundColor: '#0f172a',
            color: '#cbd5f5',
            display: 'grid',
            gap: '8px',
          },
        },
        meta: { name: 'Footer' },
      };
    case 'section':
      return {
        ...base,
        children: [],
        styles: {
          default: {
            display: 'block',
            padding: '32px',
            margin: '16px 0',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
          },
        },
        meta: { name: 'Section' },
      };
    case 'container':
      return {
        ...base,
        children: [],
        styles: {
          default: {
            display: 'block',
            padding: '16px',
          },
        },
        meta: { name: 'Container' },
      };
    case 'heading':
      return {
        ...base,
        content: { text: 'Heading', tag: 'h2' },
        styles: {
          default: {
            margin: '0 0 12px 0',
            fontSize: '32px',
            fontWeight: '700',
          },
        },
        meta: { name: 'Heading' },
      };
    case 'text':
      return {
        ...base,
        content: { text: 'Add your text here.', tag: 'p' },
        styles: {
          default: {
            margin: '0 0 16px 0',
            fontSize: '16px',
            lineHeight: '1.6',
          },
        },
        meta: { name: 'Text' },
      };
    case 'image':
      return {
        ...base,
        content: {
          src: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
          alt: 'Placeholder image',
        },
        styles: {
          default: {
            display: 'block',
            width: '100%',
            borderRadius: '12px',
          },
        },
        meta: { name: 'Image' },
      };
    case 'button':
      return {
        ...base,
        content: { text: 'Button', href: '#', target: '_self' },
        styles: {
          default: {
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#1b1f3b',
            color: '#ffffff',
            borderRadius: '999px',
            textAlign: 'center',
          },
          hover: {
            backgroundColor: '#4f46e5',
          },
        },
        meta: { name: 'Button' },
      };
    case 'divider':
      return {
        ...base,
        styles: {
          default: {
            height: '1px',
            backgroundColor: '#e2e8f0',
            margin: '24px 0',
          },
        },
        meta: { name: 'Divider' },
      };
    case 'spacer':
      return {
        ...base,
        styles: {
          default: {
            height: '24px',
          },
        },
        meta: { name: 'Spacer' },
      };
    case 'list':
      return {
        ...base,
        content: { text: 'First item\nSecond item\nThird item', tag: 'p' },
        styles: {
          default: {
            paddingLeft: '20px',
            margin: '0 0 16px 0',
          },
        },
        meta: { name: 'List' },
      };
    case 'card': {
      const cardChildren: PageNode[] = [
        createNode('image'),
        createNode('heading'),
        createNode('text'),
        createNode('button'),
      ];
      cardChildren[0].styles.default = {
        ...cardChildren[0].styles.default,
        height: '180px',
        objectFit: 'cover',
      };
      return {
        ...base,
        children: cardChildren,
        styles: {
          default: {
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
            display: 'grid',
            gap: '16px',
          },
        },
        meta: { name: 'Card' },
      };
    }
    case 'columns2': {
      const col1 = createNode('container');
      const col2 = createNode('container');
      col1.meta = { name: 'Column 1' };
      col2.meta = { name: 'Column 2' };
      return {
        ...base,
        children: [col1, col2],
        styles: {
          default: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
          },
        },
        meta: { name: 'Columns' },
      };
    }
    case 'hero': {
      const heroHeading = createNode('heading');
      heroHeading.content = { text: 'Hero headline', tag: 'h1' };
      heroHeading.styles.default['fontSize'] = '48px';
      const heroText = createNode('text');
      heroText.content = { text: 'Describe your product or service with a bold, compelling statement.', tag: 'p' };
      const heroButton = createNode('button');
      heroButton.content = { text: 'Get started', href: '#', target: '_self' };
      return {
        ...base,
        children: [heroHeading, heroText, heroButton],
        styles: {
          default: {
            padding: '64px',
            borderRadius: '24px',
            backgroundColor: '#1f2937',
            color: '#ffffff',
            display: 'grid',
            gap: '20px',
          },
        },
        meta: { name: 'Hero' },
      };
    }
    default:
      return base;
  }
};

export const collectNodes = (root: PageNode): PageNode[] => {
  const nodes: PageNode[] = [];
  const traverse = (node: PageNode): void => {
    nodes.push(node);
    node.children?.forEach(traverse);
  };
  traverse(root);
  return nodes;
};

export const buildHoverStyles = (root: PageNode): string =>
  collectNodes(root)
    .filter((node) => node.styles.hover && Object.keys(node.styles.hover).length > 0)
    .map((node) => {
      const rules = Object.entries(node.styles.hover ?? {})
        .filter(([, value]) => value)
        .map(([key, value]) => `${toKebabCase(key)}: ${value};`)
        .join(' ');
      return `.node-${node.id}:hover { ${rules} }`;
    })
    .join('\n');

export const buildDefaultStyles = (root: PageNode): string => {
  const baseRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];

  collectNodes(root).forEach((node) => {
    const baseEntries: [string, string][] = [];
    const tabletEntries: [string, string][] = [];
    const mobileEntries: [string, string][] = [];
    Object.entries(node.styles.default).forEach(([key, value]) => {
      if (!value) {
        return;
      }
      if (key.startsWith('bp-tablet-')) {
        tabletEntries.push([key.replace('bp-tablet-', ''), value]);
      } else if (key.startsWith('bp-mobile-')) {
        mobileEntries.push([key.replace('bp-mobile-', ''), value]);
      } else {
        baseEntries.push([key, value]);
      }
    });

    if (baseEntries.length) {
      const rules = baseEntries.map(([key, value]) => `${toKebabCase(key)}: ${value};`).join(' ');
      baseRules.push(`.node-${node.id} { ${rules} }`);
    }
    if (tabletEntries.length) {
      const rules = tabletEntries.map(([key, value]) => `${toKebabCase(key)}: ${value};`).join(' ');
      tabletRules.push(`.node-${node.id} { ${rules} }`);
    }
    if (mobileEntries.length) {
      const rules = mobileEntries.map(([key, value]) => `${toKebabCase(key)}: ${value};`).join(' ');
      mobileRules.push(`.node-${node.id} { ${rules} }`);
    }
  });

  const tabletBlock = tabletRules.length ? `@media (max-width: 1024px) { ${tabletRules.join(' ')} }` : '';
  const mobileBlock = mobileRules.length ? `@media (max-width: 640px) { ${mobileRules.join(' ')} }` : '';
  return [baseRules.join('\n'), tabletBlock, mobileBlock].filter(Boolean).join('\n');
};

export const toKebabCase = (value: string): string =>
  value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const renderNodeHtml = (node: PageNode): string => {
  const className = `node-${node.id}`;
  switch (node.type) {
    case 'header':
      return `<header class="${className}">${renderChildren(node)}</header>`;
    case 'footer':
      return `<footer class="${className}">${renderChildren(node)}</footer>`;
    case 'section':
      return `<section class="${className}">${renderChildren(node)}</section>`;
    case 'container':
      return `<div class="${className}">${renderChildren(node)}</div>`;
    case 'heading':
      return `<${node.content?.tag ?? 'h2'} class="${className}">${node.content?.text ?? ''}</${
        node.content?.tag ?? 'h2'
      }>`;
    case 'text':
      return `<p class="${className}">${node.content?.text ?? ''}</p>`;
    case 'image':
      return `<img class="${className}" src="${node.content?.src ?? ''}" alt="${
        node.content?.alt ?? ''
      }" />`;
    case 'button':
      return `<a class="${className}" href="${node.content?.href ?? '#'}" target="${
        node.content?.target ?? '_self'
      }">${node.content?.text ?? 'Button'}</a>`;
    case 'divider':
      return `<div class="${className}"></div>`;
    case 'spacer':
      return `<div class="${className}"></div>`;
    case 'list': {
      const items = (node.content?.text ?? '')
        .split('\n')
        .filter((item) => item.trim().length > 0)
        .map((item) => `<li>${item}</li>`)
        .join('');
      return `<ul class="${className}">${items}</ul>`;
    }
    case 'card':
      return `<div class="${className}">${renderChildren(node)}</div>`;
    case 'columns2':
      return `<div class="${className}">${renderChildren(node)}</div>`;
    case 'hero':
      return `<section class="${className}">${renderChildren(node)}</section>`;
    default:
      return `<div class="${className}"></div>`;
  }
};

const renderChildren = (node: PageNode): string =>
  (node.children ?? []).map((child) => renderNodeHtml(child)).join('');
