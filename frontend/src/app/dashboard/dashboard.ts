import { Component } from '@angular/core';
import {DatePipe, NgClass, NgComponentOutlet, NgIf} from '@angular/common';
import {RoomDialogComponent} from '../room-dialog.component/room-dialog.component';
import {InterviewsService, Room} from '../services/interview.service';
import {RouterLink} from '@angular/router';
@Component({
  selector: 'app-dashboard',
    imports: [
        NgComponentOutlet,
        RouterLink,
        DatePipe,
        NgClass,
    ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})


export class DashboardComponent {
    showDialog = false;
    RoomDialogComponent = RoomDialogComponent;

    userInterviewRooms: Room[] = [];
    selectedRoom: Room | null = null;

    constructor(public interviewServices: InterviewsService) {}

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
}

