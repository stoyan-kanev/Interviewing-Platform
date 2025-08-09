import {Component} from '@angular/core';
import {RouterLink} from '@angular/router';

@Component({
    selector: 'app-about',
    standalone: true,
    imports: [
        RouterLink
    ],
    templateUrl: './about.html',
    styleUrl: './about.css'
})
export class AboutComponent {
}
