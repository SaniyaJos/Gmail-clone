import React from 'react';
import { formatTaskDeadline } from '../../utils/formatters';

export default function InlineTaskSection({
  tasks,
  onReExtract,
  onToggleTaskStatus,
  onDeleteTask
}) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="email-tasks-section" id="email-tasks-section" style={{ display: 'block' }}>
      <div className="tasks-section-header">
        <div className="tasks-section-title">
          <span className="tasks-section-badge">Action Items</span>
          <span className="tasks-section-count" id="email-tasks-count">
            {tasks.length} item{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          type="button"
          className="btn-re-extract"
          id="btn-re-extract"
          title="Re-run AI extraction"
          onClick={onReExtract}
        >
          ↻ Re-analyze
        </button>
      </div>

      <div className="email-tasks-list" id="email-tasks-list">
        {tasks.map((task) => {
          const isCompleted = task.status === 'Completed';
          const priorityClass = `priority-${(task.priority || 'medium').toLowerCase()}`;
          const priorityLabel = `${task.priority || 'Medium'} Priority`;
          const statusClass = (task.status || 'pending').toLowerCase();

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
                  </div>
                  <div className="task-actions">
                    <button
                      type="button"
                      className="btn-task-delete"
                      title="Delete task"
                      aria-label="Delete task"
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
    </div>
  );
}
