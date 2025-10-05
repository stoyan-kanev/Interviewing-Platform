import { Component } from '@angular/core';
import {DatePipe, NgClass, NgComponentOutlet, NgIf} from '@angular/common';
import {RoomDialogComponent} from '../room-dialog.component/room-dialog.component';
import {InterviewsService, Note, Room} from '../services/interview.service';
import {RouterLink} from '@angular/router';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';


interface InterviewNote {
    id?: number;
    room_id: string;
    interviewer_id: number;
    content: string;
    timestamp: string;
    interviewer_name?: string;
    tags?: string[];
}
type NoteContent = {
    general?: string;
    technical?: string;
    questions?: string;
    decision?: string;
    rating?: number;
    recommendation?: string;
};
function toContent(raw: unknown): NoteContent {
    if (raw && typeof raw === 'object') return raw as NoteContent;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as NoteContent; } catch { /* ignore */ }
    }
    return {};
}
@Component({
  selector: 'app-dashboard',
    imports: [
        NgComponentOutlet,
        RouterLink,
        DatePipe,
        NgClass,
        ReactiveFormsModule,
    ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})


export class DashboardComponent {
    showDialog = false;
    RoomDialogComponent = RoomDialogComponent;

    userInterviewRooms: Room[] = [];
    selectedRoom: Room | null = null;
    notesOpen = false;
    notesLoading = false;
    notesError: string | null = null;

    notesForm!: FormGroup;

    constructor(
        public interviewServices: InterviewsService,
        private fb: FormBuilder
    ) {
        this.notesForm = this.fb.group({
            general: [''],
            technical: [''],
            questions: [''],
            decision: [''],
            rating: [0, [Validators.min(0), Validators.max(5)]],
            recommendation: ['']
        });
    }
    ngOnInit() { this.loadRooms(); }

    loadRooms() {
        this.interviewServices.getRooms().subscribe(rooms => this.userInterviewRooms = rooms);
    }

    openCreate() { this.selectedRoom = null; this.showDialog = true; }
    onEdit(room: Room) { this.selectedRoom = room; this.showDialog = true; }

    onToggleClose(room: Room) {
        const next = !room.is_closed;
        const action = next ? 'close' : 'open';
        if (!confirm(`Do you want to ${action} "${room.name}"?`)) return;

        this.interviewServices.closeInterview(room.id, next).subscribe({
            next: (updated) => {
                // локален ъпдейт
                this.userInterviewRooms = this.userInterviewRooms.map(r => r.id === updated.id ? updated : r);
            },
            error: (e) => console.error('Close/Open failed', e)
        });
    }

    onDelete(room: Room) {
        if (!confirm(`Permanently delete "${room.name}"? This cannot be undone.`)) return;
        this.interviewServices.deleteRoom(room.id).subscribe({
            next: () => {
                // премахни локално
                this.userInterviewRooms = this.userInterviewRooms.filter(r => r.id !== room.id);
            },
            error: (e) => console.error('Delete failed', e)
        });
    }

    closeDialog = () => { this.showDialog = false; this.selectedRoom = null; };

    // общ success за create/edit
    handleRoomSaved = (room: Room) => {
        const idx = this.userInterviewRooms.findIndex(r => r.id === room.id);
        if (idx >= 0) {
            this.userInterviewRooms = [
                ...this.userInterviewRooms.slice(0, idx),
                room,
                ...this.userInterviewRooms.slice(idx + 1),
            ];
        } else {
            this.userInterviewRooms = [room, ...this.userInterviewRooms];
        }
        this.closeDialog();
    };
    openNotes(room: Room) {
        this.selectedRoom = room;
        this.notesOpen = true;
        this.notesLoading = true;
        this.notesError = null;
        this.notesForm.reset({
            general: '',
            technical: '',
            questions: '',
            decision: '',
            rating: 0,
            recommendation: ''
        });

        this.interviewServices.getRoomNote(room.room_id).subscribe({
            next: (note: { content?: unknown } | null) => {
                const content = toContent(note?.content);

                this.notesForm.patchValue({
                    general: content.general ?? '',
                    technical: content.technical ?? '',
                    questions: content.questions ?? '',
                    decision: content.decision ?? '',
                    rating: content.rating ?? 0,
                    recommendation: content.recommendation ?? ''
                });

                this.notesLoading = false;
            },
            error: (e) => {
                console.error(e);
                this.notesError = 'Failed to load notes.';
                this.notesLoading = false;
            }
        });
    }

    closeNotes = () => {
        this.notesOpen = false;
        this.selectedRoom = null;
        this.notesError = null;
    };

    saveNotes() {
        if (!this.selectedRoom) return;
        if (this.notesForm.invalid) return;
        this.notesLoading = true;
        this.interviewServices
            .updateRoomNote(this.selectedRoom.room_id, this.notesForm.value as Partial<InterviewNote>)
            .subscribe({
                next: () => {
                    this.notesLoading = false;
                    this.notesOpen = false;
                },
                error: (e) => {
                    console.error(e);
                    this.notesError = 'Failed to save notes.';
                    this.notesLoading = false;
                }
            });
    }
}

