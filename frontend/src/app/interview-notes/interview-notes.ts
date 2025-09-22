import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, Subject, takeUntil } from 'rxjs';

interface InterviewNote {
    id?: number;
    room_id: string;
    interviewer_id: number;
    content: string;
    timestamp: string;
    interviewer_name?: string;
    tags?: string[];
}

interface NoteTemplate {
    id: string;
    name: string;
    content: string;
}

@Component({
    selector: 'app-interview-notes',
    templateUrl: './interview-notes.html',
    styleUrls: ['./interview-notes.css'],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class InterviewNotesComponent implements OnInit, OnDestroy {
    @Input() roomId!: string;
    @Input() candidateName!: string;
    @Input() isHost: boolean = false;
    @Input() interviewerId?: number;

    private destroy$ = new Subject<void>();
    private notesChange$ = new Subject<void>();

    showNotes = true;
    activeTab = 'general';
    isSaving = false;
    lastSaved: Date | null = null;
    saveStatus: 'success' | 'error' | 'saving' = 'success';

    notes = {
        general: '',
        technical: '',
        questions: '',
        decision: '',
        rating: 0,
        recommendation: ''
    };

    noteTabs = [
        { id: 'general', name: 'General', emoji: '📋' },
        { id: 'technical', name: 'Technical', emoji: '💻' },
        { id: 'questions', name: 'Q&A', emoji: '❓' },
        { id: 'decision', name: 'Decision', emoji: '✅' }
    ];

    quickActions = [
        { id: 'positive', label: 'Good Answer', emoji: '👍', type: 'positive' },
        { id: 'negative', label: 'Needs Work', emoji: '👎', type: 'negative' },
        { id: 'question', label: 'Follow-up', emoji: '❓', type: 'neutral' },
        { id: 'timestamp', label: 'Timestamp', emoji: '⏰', type: 'neutral' }
    ];

    noteTemplates: NoteTemplate[] = [
        {
            id: 'frontend',
            name: 'Frontend Developer',
            content: `TECHNICAL SKILLS:
- HTML/CSS:
- JavaScript:
- Framework (React/Angular/Vue):
- Responsive Design:

CODING EXERCISE:
- Problem-solving approach:
- Code quality:
- Best practices:

GENERAL:
- Communication:
- Questions asked:
- Culture fit: `
        },
        {
            id: 'backend',
            name: 'Backend Developer',
            content: `TECHNICAL SKILLS:
- Programming Language:
- Database Knowledge:
- API Design:
- System Architecture:

CODING EXERCISE:
- Algorithm thinking:
- Code structure:
- Performance considerations:

GENERAL:
- Problem-solving:
- Team collaboration:
- Learning attitude: `
        },
        {
            id: 'fullstack',
            name: 'Full-Stack Developer',
            content: `FRONTEND SKILLS:
- UI/UX Understanding:
- JavaScript Frameworks:

BACKEND SKILLS:
- Server-side Technologies:
- Database Design:

SYSTEM DESIGN:
- Architecture Thinking:
- Scalability Awareness:

GENERAL:
- Versatility:
- Communication:
- Project Experience: `
        }
    ];

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        if (this.isHost) {
            this.loadExistingNotes();
            this.setupAutoSave();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private setupAutoSave(): void {
        this.notesChange$.pipe(
            debounceTime(10000),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.saveNotes(true);
        });
    }

    private loadExistingNotes(): void {
        if (!this.roomId) return;

        this.http.get<InterviewNote>(`http://localhost:8000/interview-notes/${this.roomId}/`)
            .subscribe({
                next: (note) => {
                    if (note && note.content) {
                        try {
                            const parsedNotes = JSON.parse(note.content);
                            this.notes = { ...this.notes, ...parsedNotes };
                            console.log('📋 Loaded existing notes');
                        } catch (e) {
                            this.notes.general = note.content;
                        }
                    }
                },
                error: (err) => {
                    console.log('📋 No existing notes found (this is normal for new interviews)');
                }
            });
    }

    loadTemplate(event: any): void {
        const templateId = event.target.value;
        if (!templateId) return;

        const template = this.noteTemplates.find(t => t.id === templateId);
        if (template) {
            const currentContent = this.notes.general;
            this.notes.general = currentContent ?
                `${currentContent}\n\n--- ${template.name} Template ---\n${template.content}` :
                template.content;

            this.activeTab = 'general';
            this.onNotesChange();

            event.target.value = '';
        }
    }

    addQuickNote(action: any): void {
        const timestamp = new Date().toLocaleTimeString();
        let noteText = '';

        switch (action.id) {
            case 'positive':
                noteText = `[${timestamp}] ✅ Good response - `;
                break;
            case 'negative':
                noteText = `[${timestamp}] ❌ Needs improvement - `;
                break;
            case 'question':
                noteText = `[${timestamp}] ❓ Follow-up: `;
                break;
            case 'timestamp':
                noteText = `[${timestamp}] 📝 Note: `;
                break;
        }

        const currentTabContent = this.getCurrentTabContent();
        this.setCurrentTabContent(currentTabContent + noteText);
        this.onNotesChange();
    }

    private getCurrentTabContent(): string {
        switch (this.activeTab) {
            case 'general': return this.notes.general;
            case 'technical': return this.notes.technical;
            case 'questions': return this.notes.questions;
            case 'decision': return this.notes.decision;
            default: return '';
        }
    }

    private setCurrentTabContent(content: string): void {
        switch (this.activeTab) {
            case 'general': this.notes.general = content; break;
            case 'technical': this.notes.technical = content; break;
            case 'questions': this.notes.questions = content; break;
            case 'decision': this.notes.decision = content; break;
        }
    }

    setRating(rating: number): void {
        this.notes.rating = rating;
        this.onNotesChange();
    }

    getRatingText(): string {
        const ratings = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];
        return ratings[this.notes.rating] || '';
    }

    onNotesChange(): void {
        this.notesChange$.next();
    }

    toggleNotesPanel(): void {
        this.showNotes = !this.showNotes;
    }

    async saveNotes(silent: boolean = false): Promise<void> {
        if (!this.interviewerId || !this.roomId) {
            console.error('❌ Missing interviewer ID or room ID');
            return;
        }

        if (!silent) {
            this.isSaving = true;
        }
        this.saveStatus = 'saving';

        const noteData: Partial<InterviewNote> = {
            room_id: this.roomId,
            interviewer_id: this.interviewerId,
            content: JSON.stringify(this.notes),
            timestamp: new Date().toISOString(),
            interviewer_name: this.candidateName
        };

        try {
            await this.http.post(`http://localhost:8000/interview-notes/${this.roomId}/`, noteData).toPromise();

            this.saveStatus = 'success';
            this.lastSaved = new Date();

            if (!silent) {
                console.log('💾 Notes saved successfully');
            }
        } catch (error) {
            console.error('❌ Failed to save notes:', error);
            this.saveStatus = 'error';
        } finally {
            if (!silent) {
                this.isSaving = false;
            }
        }
    }

    get saveStatusText(): string {
        switch (this.saveStatus) {
            case 'saving': return '💾 Saving...';
            case 'success': return `✅ Saved at ${this.lastSaved?.toLocaleTimeString()}`;
            case 'error': return '❌ Save failed';
            default: return '';
        }
    }
}
