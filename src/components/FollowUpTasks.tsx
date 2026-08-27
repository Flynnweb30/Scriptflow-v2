import React, { useState } from 'react';
import { Task, Appointment } from '../types';
import { Utils } from '../utils/helpers';
import { FirestoreService } from '../services/FirestoreService';
import { WorkspaceService } from '../services/WorkspaceService';

interface FollowUpTasksProps {
    tasks: Task[];
    appointments: Appointment[];
    onSelectAppointment?: (appt: Appointment) => void;
}

export const FollowUpTasks: React.FC<FollowUpTasksProps> = ({
    tasks,
    appointments,
    onSelectAppointment
}) => {
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState(Utils.getTodayStr());
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [selectedApptId, setSelectedApptId] = useState<string>('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [copiedTasks, setCopiedTasks] = useState(false);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) return;

        const newTask: Task = {
            id: 'task_' + Utils.generateId(),
            description: description.trim(),
            dueDate,
            priority,
            appointmentId: selectedApptId || null,
            completed: false,
            createdAt: new Date().toISOString()
        };

        try {
            await FirestoreService.saveTask(newTask);
        } catch (error: any) {
            alert(error?.message || 'Unable to save the task. Please try again.');
            return;
        }
        setDescription('');
        setSelectedApptId('');
    };

    const handleToggleTask = async (task: Task) => {
        try {
            await FirestoreService.saveTask({
                ...task,
                completed: !task.completed
            });
        } catch (error: any) {
            alert(error?.message || 'Unable to update the task. Please try again.');
        }
    };

    const handleDeleteTask = async (id: string) => {
        try {
            await FirestoreService.deleteTask(id);
        } catch (error: any) {
            alert(error?.message || 'Unable to delete the task. Please try again.');
        }
    };

    const handleCopyGoogleTasks = async () => {
        const payload = WorkspaceService.exportToTasksJSON(tasks);
        try {
            await navigator.clipboard.writeText(payload);
            setCopiedTasks(true);
        } catch {
            alert('Clipboard access is unavailable. Please copy the generated Tasks JSON manually.');
        }
        setTimeout(() => setCopiedTasks(false), 2000);
    };

    const filtered = tasks.filter(t => {
        if (filter === 'pending') return !t.completed;
        if (filter === 'completed') return t.completed;
        return true;
    });

    const pendingCount = tasks.filter(t => !t.completed).length;

    return (
        <div className="tasks-container" style={{ padding: '0 0 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <i className="fas fa-tasks" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                        Follow-Up Task Manager
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                        Keep track of callbacks, proposal reviews, and Google Tasks sync
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                        className="btn-secondary" 
                        onClick={handleCopyGoogleTasks}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}
                    >
                        <i className={`fas fa-${copiedTasks ? 'check text-green-500' : 'clipboard-list'}`}></i>
                        <span>{copiedTasks ? 'Copied Tasks JSON!' : 'Export to Google Tasks'}</span>
                    </button>
                </div>
            </div>

            {/* Task Creation Card */}
            <form onSubmit={handleAddTask} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Task Description:</label>
                        <input 
                            type="text"
                            placeholder="e.g. Call back John regarding updated pricing quote..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Due Date:</label>
                        <input 
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Priority:</label>
                        <select 
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as any)}
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                        >
                            <option value="low">🟢 Low Priority</option>
                            <option value="medium">🟡 Medium Priority</option>
                            <option value="high">🔴 High Priority</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>Attach to Appointment:</label>
                        <select 
                            value={selectedApptId}
                            onChange={(e) => setSelectedApptId(e.target.value)}
                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                        >
                            <option value="">None (General Task)</option>
                            {appointments.map(a => (
                                <option key={a.id} value={a.id}>{a.business} ({a.contactName || 'No contact'})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        type="submit" 
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '13px' }}
                    >
                        <i className="fas fa-plus"></i>
                        <span>Add Task</span>
                    </button>
                </div>
            </form>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                        onClick={() => setFilter('all')}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', borderColor: filter === 'all' ? 'var(--primary)' : 'var(--border-color)', background: filter === 'all' ? 'var(--primary)' : 'var(--bg-card)', color: filter === 'all' ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                        All ({tasks.length})
                    </button>
                    <button 
                        onClick={() => setFilter('pending')}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', borderColor: filter === 'pending' ? 'var(--primary)' : 'var(--border-color)', background: filter === 'pending' ? 'var(--primary)' : 'var(--bg-card)', color: filter === 'pending' ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Pending ({pendingCount})
                    </button>
                    <button 
                        onClick={() => setFilter('completed')}
                        style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid', borderColor: filter === 'completed' ? 'var(--primary)' : 'var(--border-color)', background: filter === 'completed' ? 'var(--primary)' : 'var(--bg-card)', color: filter === 'completed' ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Completed ({tasks.length - pendingCount})
                    </button>
                </div>
            </div>

            {/* Task List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.length === 0 ? (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <i className="far fa-check-circle" style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--success)' }}></i>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No tasks found in this view</p>
                    </div>
                ) : (
                    filtered.map(task => {
                        const linkedAppt = task.appointmentId ? appointments.find(a => a.id === task.appointmentId) : null;
                        return (
                            <div 
                                key={task.id}
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    padding: '14px 18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '14px',
                                    opacity: task.completed ? 0.6 : 1,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                                    <input 
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={() => handleToggleTask(task)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                    />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textDecoration: task.completed ? 'line-through' : 'none' }}>
                                            {task.description}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            {task.dueDate && (
                                                <span>
                                                    <i className="far fa-calendar" style={{ marginRight: '4px' }}></i>
                                                    Due: {Utils.formatDate(task.dueDate)}
                                                </span>
                                            )}
                                            <span style={{
                                                fontWeight: 700,
                                                color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'
                                            }}>
                                                ● {task.priority.toUpperCase()}
                                            </span>
                                            {linkedAppt && (
                                                <button 
                                                    onClick={() => onSelectAppointment && onSelectAppointment(linkedAppt)}
                                                    style={{ border: 'none', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    <i className="fas fa-link" style={{ marginRight: '4px' }}></i>
                                                    {linkedAppt.business}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleDeleteTask(task.id)}
                                    style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                                    title="Delete Task"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
