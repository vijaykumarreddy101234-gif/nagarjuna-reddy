import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer = ({ content }) => {
  const renderContent = () => {
    if (!content) return [];
    const lines = content.split('\n');
    // FIX: Replaced JSX.Element with React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
    // Also, refactored list handling to correctly parse and render lists, fixing several runtime bugs.
    const elements: React.ReactElement[] = [];
    let currentListItems: React.ReactElement[] = [];

    const flushList = (key: string) => {
      if (currentListItems.length > 0) {
        elements.push(<ul key={key} className="list-disc list-inside space-y-1 mb-3">{currentListItems}</ul>);
        currentListItems = [];
      }
    };

    lines.forEach((line, index) => {
      const isListItem = line.trim().startsWith('* ') || line.trim().startsWith('- ');

      if (!isListItem) {
        flushList(`ul-flush-${index}`);
      }
      
      // Headings
      if (line.startsWith('## ')) {
        elements.push(<h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.substring(3)}</h3>);
      } else if (line.startsWith('# ')) {
        elements.push(<h2 key={index} className="text-xl font-bold mt-4 mb-2">{line.substring(2)}</h2>);
      }
      // List items
      else if (isListItem) {
        const itemContent = line.trim().substring(2);
        const processedContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        currentListItems.push(<li key={`li-${index}`} dangerouslySetInnerHTML={{ __html: processedContent }} />);
      }
      // Paragraphs
      else if (line.trim() !== '') {
        const processedContent = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        elements.push(<p key={index} className="mb-2" dangerouslySetInnerHTML={{ __html: processedContent }} />);
      }
    });
    
    // Close any open list at the end
    flushList('ul-end');

    return elements;
  };

  return <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">{renderContent()}</div>;
};

export default MarkdownRenderer;
