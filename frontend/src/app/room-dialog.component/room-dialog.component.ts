import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InterviewsService, Room } from '../services/interview.service';

@Component({
    selector: 'app-room-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './room-dialog.component.html',
    styleUrls: ['./room-dialog.component.css']
})
export class RoomDialogComponent {
    form: FormGroup;
    loading = false;

    @Input({ required: true }) close!: () => void;
    @Input({ required: true }) onSuccess!: (room: Room) => void;

    // нови входове
    @Input() mode: 'create' | 'edit' = 'create';
    @Input() room: Room | null = null;

    constructor(
        private fb: FormBuilder,
        private api: InterviewsService,
    ) {
        this.form = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
        });
    }

    ngOnInit() {
        if (this.mode === 'edit' && this.room) {
            this.form.patchValue({ name: this.room.name });
        }
    }

    submit() {
        if (this.form.invalid) return;
        this.loading = true;

        const name = this.form.value.name!.trim();

        if (this.mode === 'edit' && this.room) {
            this.api.updateRoom(this.room.id, { name }).subscribe({
                next: (updated) => {
                    this.onSuccess?.(updated);
                    this.close?.();
                },
                error: (err) => {
                    console.error('Failed to update room:', err);
                    this.loading = false;
                }
            });
        } else {
            this.api.createRoom(name).subscribe({
                next: (created) => {
                    this.onSuccess?.(created);
                    this.close?.();
                },
                error: (err) => {
                    console.error('Failed to create room:', err);
                    this.loading = false;
                }
            });
        }
    }
}
