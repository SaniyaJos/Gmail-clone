import React, { useState, useMemo } from 'react';
import { formatTaskDeadline } from '../../utils/formatters';

export default function ActionsPanel({
  tasks,
  isLoading,
  userEmail,
  trashedEmailIds,
  onToggleTaskStatus,
  onDeleteTask,
  onOpenSourceEmail
}) {
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'Pending', 'Completed'
  const [priorityFilter, setPriorityFilter] = useState(''); // '', 'High', 'Medium', 'Low'

  const filteredTasks = useMemo(() => {
    return (tasks || []).filter((task) => {
      if (filterTab === 'Pending' && task.status === 'Completed') return false;
      if (filterTab === 'Completed' && task.status !== 'Completed') return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, filterTab, priorityFilter]);

  return (
    <div className="actions-panel-view" id="actions-panel-view" style={{ display: 'flex' }}>
      <div className="actions-panel-header">
        <div className="actions-header-info">
          <div className="actions-title-row">
            <h2 className="actions-panel-title">My Actions</h2>
            <span className="actions-ai-tag">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
              </svg>
              AI Engine
            </span>
          </div>
          <span className="actions-panel-subtitle">Actionable tasks extracted from your emails</span>
        </div>

        <div className="actions-header-controls">
          <div className="actions-filter-tabs">
            <button
              type="button"
              className={`action-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`action-tab-btn ${filterTab === 'Pending' ? 'active' : ''}`}
              onClick={() => setFilterTab('Pending')}
            >
              Pending
            </button>
            <button
              type="button"
              className={`action-tab-btn ${filterTab === 'Completed' ? 'active' : ''}`}
              onClick={() => setFilterTab('Completed')}
            >
              Completed
            </button>
          </div>

          <select
            className="action-priority-select"
            id="action-priority-filter"
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="actions-loading-state" id="actions-loading" style={{ display: 'flex' }}>
          <div className="action-spinner" />
          <span>Loading tasks...</span>
        </div>
      )}

      {!isLoading && filteredTasks.length === 0 && (
        <div className="actions-empty-state" id="actions-empty-state" style={{ display: 'flex' }}>
          <div className="actions-empty-icon">✓</div>
          <div className="actions-empty-title">
            {filterTab === 'Completed'
              ? 'No completed tasks yet'
              : filterTab === 'Pending'
              ? 'No pending tasks!'
              : 'No actionable tasks found'}
          </div>
          <div className="actions-empty-subtitle">
            {filterTab === 'Completed'
              ? 'Complete your pending action items to see them recorded here.'
              : filterTab === 'Pending'
              ? 'Great job! You have cleared all actionable tasks from your emails.'
              : 'Open any email and click "Extract Actions" to automatically detect tasks, deadlines, and priorities.'}
          </div>
        </div>
      )}

      {!isLoading && filteredTasks.length > 0 && (
        <div className="actions-tasks-container" id="actions-tasks-container">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'Completed';
            const priorityClass = `priority-${(task.priority || 'medium').toLowerCase()}`;
            const priorityLabel = `${task.priority || 'Medium'} Priority`;
            const statusClass = (task.status || 'pending').toLowerCase();

            // Deadline info
            const deadlineInfo = formatTaskDeadline(task.deadline);
            let deadlineElement = null;
            if (deadlineInfo) {
              const passedClass = deadlineInfo.isOverdue && !isCompleted ? 'passed' : '';
              const icon = deadlineInfo.isOverdue && !isCompleted ? '⚠️' : '📅';
              deadlineElement = (
                <span className={`deadline-chip ${passedClass}`}>
                  {icon} {deadlineInfo.text}
                </span>
              );
            } else {
              deadlineElement = <span className="deadline-chip no-deadline">No deadline</span>;
            }

            // Source Email Reference
            let emailRefElement = null;
            const emailObj = task.emailId;
            const emailRawId = typeof emailObj === 'object' && emailObj?._id ? String(emailObj._id) : (task.emailId ? String(task.emailId) : null);
            const isEmailInTrash = Boolean(
              (emailObj && typeof emailObj === 'object' && emailObj.isTrash) ||
              (emailRawId && trashedEmailIds && trashedEmailIds.has(emailRawId))
            );

            if (emailObj && typeof emailObj === 'object') {
              const emailSubject = emailObj.subject || task.emailSubject || '(No Subject)';
              const rawSender = (emailObj.sender || '').toLowerCase();
              const rawReceiver = (emailObj.receiver || '').toLowerCase();
              const currentEmail = (userEmail || '').toLowerCase();

              const senderDisplay = emailObj.senderName || rawSender.split('@')[0] || 'Unknown';
              const receiverDisplay = emailObj.receiverName || rawReceiver.split('@')[0] || 'Unknown';
              const displayTarget = currentEmail === rawSender
                ? `To: ${receiverDisplay}`
                : `From: ${senderDisplay}`;

              if (isEmailInTrash) {
                emailRefElement = (
                  <button
                    type="button"
                    className="task-email-ref in-trash"
                    title={`This email is in Bin (${displayTarget}): ${emailSubject}. Click to view`}
                    onClick={() => onOpenSourceEmail({ ...emailObj, isTrash: true })}
                  >
                    🗑️ [In Bin] ✉ {displayTarget} • {emailSubject}
                  </button>
                );
              } else if (emailObj.isSpam) {
                emailRefElement = (
                  <button
                    type="button"
                    className="task-email-ref in-spam"
                    title={`This email is in Spam (${displayTarget}): ${emailSubject}. Click to view`}
                    onClick={() => onOpenSourceEmail(emailObj)}
                  >
                    🚨 [In Spam] ✉ {displayTarget} • {emailSubject}
                  </button>
                );
              } else {
                emailRefElement = (
                  <button
                    type="button"
                    className="task-email-ref"
                    title={`View email (${displayTarget}): ${emailSubject}`}
                    onClick={() => onOpenSourceEmail(emailObj)}
                  >
                    ✉ {displayTarget} • {emailSubject}
                  </button>
                );
              }
            } else if (task.emailId) {
              const subj = task.emailSubject || 'View source email';
              if (isEmailInTrash) {
                emailRefElement = (
                  <button
                    type="button"
                    className="task-email-ref in-trash"
                    title={`This email is in Bin: ${subj}. Click to view`}
                    onClick={() => onOpenSourceEmail(task.emailId)}
                  >
                    🗑️ [In Bin] ✉ {subj}
                  </button>
                );
              } else {
                emailRefElement = (
                  <button
                    type="button"
                    className="task-email-ref"
                    title={`View email: ${subj}`}
                    onClick={() => onOpenSourceEmail(task.emailId)}
                  >
                    ✉ {subj}
                  </button>
                );
              }
            } else {
              const subjectDisplay = task.emailSubject ? ` (${task.emailSubject})` : '';
              emailRefElement = (
                <span
                  className="task-email-ref deleted"
                  title="The source email was permanently deleted, but your task details remain safely saved here."
                >
                  ⚠️ Original email deleted{subjectDisplay}
                </span>
              );
            }

            return (
              <div
                key={task._id}
                className={`task-card ${isCompleted ? 'completed' : ''}`}
                data-id={task._id}
              >
                <div className="task-checkbox-container">
                  <input
                    type="checkbox"
                    className="task-checkbox"
                    checked={isCompleted}
                    onChange={(e) =>
                      onToggleTaskStatus(task._id, e.target.checked ? 'Completed' : 'Pending')
                    }
                    aria-label="Toggle complete task"
                  />
                </div>
                <div className="task-details">
                  <div className="task-header-line">
                    <span className="task-title">{task.title}</span>
                    <div className="task-badges">
                      <span className={`priority-chip ${priorityClass}`}>{priorityLabel}</span>
                      <span className={`status-chip ${statusClass}`}>{task.status}</span>
                    </div>
                  </div>
                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}
                  {task.reason && (
                    <div className="task-reason">💡 {task.reason}</div>
                  )}
                  <div className="task-meta-footer">
                    <div className="task-meta-left">
                      {deadlineElement}
                      {emailRefElement}
                    </div>
                    <div className="task-actions">
                      <button
                        type="button"
                        className="btn-task-delete"
                        onClick={() => {
                          if (window.confirm('Delete this task?')) {
                            onDeleteTask(task._id);
                          }
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
