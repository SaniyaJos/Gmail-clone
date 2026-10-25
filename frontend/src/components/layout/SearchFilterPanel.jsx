import React, { useState, useEffect, useRef } from 'react';

export default function SearchFilterPanel({
  isOpen,
  onClose,
  onApplySearch,
  toggleButtonRef
}) {
  const [fromVal, setFromVal] = useState('');
  const [toVal, setToVal] = useState('');
  const [subjectVal, setSubjectVal] = useState('');
  const [wordsVal, setWordsVal] = useState('');
  const [excludeVal, setExcludeVal] = useState('');

  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        (!toggleButtonRef.current || !toggleButtonRef.current.contains(e.target))
      ) {
        onClose();
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen, onClose, toggleButtonRef]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const terms = [];
    if (fromVal.trim()) terms.push(`from:"${fromVal.trim().replace(/"/g, '')}"`);
    if (toVal.trim()) terms.push(`to:"${toVal.trim().replace(/"/g, '')}"`);
    if (subjectVal.trim()) terms.push(`subject:"${subjectVal.trim().replace(/"/g, '')}"`);
    if (wordsVal.trim()) terms.push(`"${wordsVal.trim().replace(/"/g, '')}"`);
    if (excludeVal.trim()) terms.push(`-"${excludeVal.trim().replace(/"/g, '')}"`);

    const query = terms.join(' ');
    onApplySearch(query);
    onClose();
  };

  const handleClear = () => {
    setFromVal('');
    setToVal('');
    setSubjectVal('');
    setWordsVal('');
    setExcludeVal('');
    onApplySearch('');
    onClose();
  };

  return (
    <form
      ref={panelRef}
      className="search-filter-panel"
      id="search-filter-panel"
      onSubmit={handleSubmit}
    >
      <label>
        From
        <input
          type="text"
          id="filter-from"
          autoComplete="off"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
        />
      </label>
      <label>
        To
        <input
          type="text"
          id="filter-to"
          autoComplete="off"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
        />
      </label>
      <label>
        Subject
        <input
          type="text"
          id="filter-subject"
          autoComplete="off"
          value={subjectVal}
          onChange={(e) => setSubjectVal(e.target.value)}
        />
      </label>
      <label>
        Has the words
        <input
          type="text"
          id="filter-words"
          autoComplete="off"
          value={wordsVal}
          onChange={(e) => setWordsVal(e.target.value)}
        />
      </label>
      <label>
        Doesn't have
        <input
          type="text"
          id="filter-exclude"
          autoComplete="off"
          value={excludeVal}
          onChange={(e) => setExcludeVal(e.target.value)}
        />
      </label>
      <div className="search-filter-actions">
        <button type="button" id="filter-clear" onClick={handleClear}>
          Clear
        </button>
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
