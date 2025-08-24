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
    candidate_name?: string;
    tags?: string[];
}

interface NoteTemplate {
    id: string;
    name: string;
    content: string;
}

@Component({
    selector: 'app-interview-notes',
    template: `
    <div class="notes-container" *ngIf="isHost">
      <div class="notes-header">
        <div class="header-title">
          <h3>📝 Interview Notes</h3>
          <span class="candidate-info" *ngIf="candidateName">
            Candidate: {{ candidateName }}
          </span>
        </div>

        <div class="header-controls">
          <select (change)="loadTemplate($event)" class="template-selector">
            <option value="">Choose template...</option>
            <option *ngFor="let template of noteTemplates" [value]="template.id">
              {{ template.name }}
            </option>
          </select>

          <button (click)="saveNotes()"
                  [disabled]="isSaving"
                  class="save-btn"
                  [class.saving]="isSaving">
            {{ isSaving ? '💾 Saving...' : '💾 Save' }}
          </button>

          <button (click)="toggleNotesPanel()" class="toggle-btn">
            {{ showNotes ? '➖' : '➕' }}
          </button>
        </div>
      </div>

      <div class="notes-content" [class.collapsed]="!showNotes">

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button *ngFor="let action of quickActions"
                  (click)="addQuickNote(action)"
                  class="quick-action-btn"
                  [class]="action.type">
            {{ action.emoji }} {{ action.label }}
          </button>
        </div>

        <!-- Notes Tabs -->
        <div class="notes-tabs">
          <button *ngFor="let tab of noteTabs"
                  (click)="activeTab = tab.id"
                  class="tab-btn"
                  [class.active]="activeTab === tab.id">
            {{ tab.emoji }} {{ tab.name }}
          </button>
        </div>

        <!-- Notes Editor -->
        <div class="notes-editor">
          <div *ngIf="activeTab === 'general'" class="tab-content">
            <label>General Notes:</label>
            <textarea
              [(ngModel)]="notes.general"
              (ngModelChange)="onNotesChange()"
              placeholder="Overall impression, communication skills, personality fit..."
              rows="6"
              class="notes-textarea">
            </textarea>
          </div>

          <div *ngIf="activeTab === 'technical'" class="tab-content">
            <label>Technical Assessment:</label>
            <textarea
              [(ngModel)]="notes.technical"
              (ngModelChange)="onNotesChange()"
              placeholder="Coding skills, problem-solving approach, technical knowledge..."
              rows="6"
              class="notes-textarea">
            </textarea>
          </div>

          <div *ngIf="activeTab === 'questions'" class="tab-content">
            <label>Questions & Answers:</label>
            <textarea
              [(ngModel)]="notes.questions"
              (ngModelChange)="onNotesChange()"
              placeholder="Key questions asked and candidate responses..."
              rows="6"
              class="notes-textarea">
            </textarea>
          </div>

          <div *ngIf="activeTab === 'decision'" class="tab-content">
            <label>Final Decision:</label>

            <div class="rating-section">
              <label>Overall Rating:</label>
              <div class="rating-stars">
                <button *ngFor="let star of [1,2,3,4,5]; let i = index"
                        (click)="setRating(star)"
                        class="star-btn"
                        [class.active]="notes.rating >= star">
                  ⭐
                </button>
                <span class="rating-text">{{ getRatingText() }}</span>
              </div>
            </div>

            <div class="recommendation-section">
              <label>Recommendation:</label>
              <select [(ngModel)]="notes.recommendation" (ngModelChange)="onNotesChange()" class="recommendation-select">
                <option value="">Select recommendation...</option>
                <option value="strong_hire">🟢 Strong Hire</option>
                <option value="hire">🟡 Hire</option>
                <option value="no_hire">🔴 No Hire</option>
                <option value="strong_no_hire">⛔ Strong No Hire</option>
              </select>
            </div>

            <textarea
              [(ngModel)]="notes.decision"
              (ngModelChange)="onNotesChange()"
              placeholder="Final thoughts, concerns, reasons for recommendation..."
              rows="4"
              class="notes-textarea">
            </textarea>
          </div>
        </div>

        <!-- Auto-save indicator -->
        <div class="save-status" *ngIf="lastSaved">
          <span class="save-indicator" [class.success]="saveStatus === 'success'" [class.error]="saveStatus === 'error'">
            {{ saveStatusText }}
          </span>
        </div>
      </div>
    </div>
  `,
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
        // Auto-save every 10 seconds when there are changes
        this.notesChange$.pipe(
            debounceTime(10000),
            takeUntil(this.destroy$)
        ).subscribe(() => {
            this.saveNotes(true); // true = silent save
        });
    }

    private loadExistingNotes(): void {
        if (!this.roomId) return;

        this.http.get<InterviewNote>(`/api/interview-notes/${this.roomId}/`)
            .subscribe({
                next: (note) => {
                    if (note && note.content) {
                        try {
                            const parsedNotes = JSON.parse(note.content);
                            this.notes = { ...this.notes, ...parsedNotes };
                            console.log('📋 Loaded existing notes');
                        } catch (e) {
                            // Legacy format - put in general notes
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
            // Add template to general notes (don't overwrite existing content)
            const currentContent = this.notes.general;
            this.notes.general = currentContent ?
                `${currentContent}\n\n--- ${template.name} Template ---\n${template.content}` :
                template.content;

            this.activeTab = 'general';
            this.onNotesChange();

            // Reset select
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

        // Add to current tab's notes
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
            candidate_name: this.candidateName
        };

        try {
            await this.http.post('/api/interview-notes/', noteData).toPromise();

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
