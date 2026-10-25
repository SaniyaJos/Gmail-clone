import React from 'react';

export default function EmailBody({ body }) {
  if (!body) return <div className="details-content" />;

  const lines = body.split('\n');
  const renderedElements = [];
  let currentQuotes = [];
  let inQuote = false;
  let quoteHeader = null;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const cleanForCheck = line.replace(/^[>\s]+/, '').trim();
    const isQuoteHeader = /^on\s+.+\s+wrote:$/i.test(cleanForCheck);

    if (isQuoteHeader) {
      if (inQuote && currentQuotes.length > 0) {
        renderedElements.push(
          <div key={`quote-${index}`} className="gmail-quote">
            {currentQuotes.map((q, qIdx) => (
              <div key={qIdx}>{q}</div>
            ))}
          </div>
        );
        currentQuotes = [];
      }
      renderedElements.push(
        <div key={`qheader-${index}`} className="gmail-quote-header">
          {cleanForCheck}
        </div>
      );
      inQuote = true;
      return;
    }

    if (line.startsWith('>')) {
      inQuote = true;
      currentQuotes.push(line.replace(/^>+\s?/, ''));
      return;
    }

    if (inQuote) {
      renderedElements.push(
        <div key={`quote-${index}`} className="gmail-quote">
          {currentQuotes.map((q, qIdx) => (
            <div key={qIdx}>{q}</div>
          ))}
        </div>
      );
      currentQuotes = [];
      inQuote = false;
    }

    renderedElements.push(
      <div key={`line-${index}`} style={{ minHeight: line ? undefined : '1em' }}>
        {line || '\u00A0'}
      </div>
    );
  });

  if (inQuote && currentQuotes.length > 0) {
    renderedElements.push(
      <div key="quote-final" className="gmail-quote">
        {currentQuotes.map((q, qIdx) => (
          <div key={qIdx}>{q}</div>
        ))}
      </div>
    );
  }

  return <div className="details-content">{renderedElements}</div>;
}
