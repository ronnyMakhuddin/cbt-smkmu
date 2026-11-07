import { useMemo } from 'react';
import { renderContent } from '../lib/content';

export default function RichText({ value, className = '', style }) {
  const html = useMemo(() => renderContent(value || ''), [value]);
  return <div className={`content ${className}`} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
