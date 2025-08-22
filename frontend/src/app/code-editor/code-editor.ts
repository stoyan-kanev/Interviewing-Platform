import { Component, ElementRef, OnInit, OnDestroy, ViewChild, Input } from '@angular/core';
import { WebSocketService } from '../services/websocket';
import {NgForOf, NgIf} from '@angular/common';

// Monaco Editor types
declare var monaco: any;

interface CodeChange {
    range: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    };
    text: string;
    timestamp: number;
    userId: string;
}

@Component({
    selector: 'app-shared-code-editor',
    template: `
    <div class="code-editor-container">
      <div class="editor-header">
        <div class="editor-controls">
          <select (change)="changeLanguage($event)" [value]="currentLanguage">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="csharp">C#</option>
            <option value="cpp">C++</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="sql">SQL</option>
            <option value="json">JSON</option>
          </select>

          <button (click)="runCode()" [disabled]="!canRunCode()" class="run-btn">
            ▶️ Run Code
          </button>

          <button (click)="resetCode()" class="reset-btn">
            🔄 Reset
          </button>

          <div class="collaborators">
            <span *ngFor="let user of activeUsers" class="user-indicator" [style.background-color]="user.color">
              {{ user.name }}
            </span>
          </div>
        </div>
      </div>

      <div class="editor-wrapper">
        <div #editorContainer class="monaco-editor-container"></div>

        <div class="output-panel" *ngIf="showOutput">
          <div class="output-header">
            <span>Output</span>
            <button (click)="closeOutput()" class="close-output">✕</button>
          </div>
          <pre class="output-content">{{ outputContent }}</pre>
        </div>
      </div>
    </div>
  `,
    styleUrls: ['./code-editor.css'],
    standalone: true,
    imports: [NgIf, NgForOf]
})
export class SharedCodeEditorComponent implements OnInit, OnDestroy {
    @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;
    @Input() roomId!: string;
    @Input() userId!: string;
    @Input() userName!: string;
    @Input() isHost: boolean = false;

    private editor: any;
    private isUpdatingRemotely = false;
    private lastChangeTimestamp = 0;

    currentLanguage = 'javascript';
    showOutput = false;
    outputContent = '';

    activeUsers: Array<{id: string, name: string, color: string}> = [];

    // Цветове за потребителите
    private userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

    constructor(private ws: WebSocketService) {}

    async ngOnInit() {
        // Зареждаме Monaco Editor
        await this.loadMonacoEditor();
        this.initializeEditor();
        this.setupWebSocketListeners();

        // Регистрираме се като active user
        this.ws.sendJoinCodeEditor(this.roomId, {
            id: this.userId,
            name: this.userName,
            color: this.getUserColor()
        });
    }

    ngOnDestroy() {
        if (this.editor) {
            this.editor.dispose();
        }
        this.ws.sendLeaveCodeEditor(this.roomId, this.userId);
    }

    private async loadMonacoEditor(): Promise<void> {
        return new Promise((resolve) => {
            if (typeof monaco !== 'undefined') {
                resolve();
                return;
            }

            // Зареждаме Monaco от CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js';
            script.onload = () => {
                (window as any).require.config({
                    paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
                });

                (window as any).require(['vs/editor/editor.main'], () => {
                    resolve();
                });
            };
            document.head.appendChild(script);
        });
    }

    private initializeEditor(): void {
        const initialCode = this.getInitialCode();

        this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
            value: initialCode,
            language: this.currentLanguage,
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            bracketMatching: 'always',
            autoIndent: 'full'
        });

        // Слушаме за промени в кода
        this.editor.onDidChangeModelContent((event: any) => {
            if (!this.isUpdatingRemotely) {
                this.handleLocalCodeChange(event);
            }
        });

        console.log('📝 Monaco Editor initialized');
    }

    private setupWebSocketListeners(): void {
        // Слушаме за промени в кода от други потребители
        this.ws.onCodeChange().subscribe((change: CodeChange) => {
            if (change.userId !== this.userId) {
                this.applyRemoteChange(change);
            }
        });

        // Слушаме за промяна на езика
        this.ws.onLanguageChange().subscribe((data: {language: string, userId: string}) => {
            if (data.userId !== this.userId) {
                this.currentLanguage = data.language;
                monaco.editor.setModelLanguage(this.editor.getModel(), this.currentLanguage);
                console.log('🔄 Language changed to:', this.currentLanguage);
            }
        });

        // Слушаме за нови потребители
        this.ws.onCodeEditorUserJoined().subscribe((user: any) => {
            if (user.id !== this.userId) {
                this.activeUsers.push(user);
                console.log('👋 Code editor user joined:', user.name);
            }
        });

        // Слушаме за напуснали потребители
        this.ws.onCodeEditorUserLeft().subscribe((userId: string) => {
            this.activeUsers = this.activeUsers.filter(u => u.id !== userId);
            console.log('👋 Code editor user left:', userId);
        });

        // Слушаме за резултат от изпълнение на код
        this.ws.onCodeExecutionResult().subscribe((result: {output: string, error?: string}) => {
            this.outputContent = result.error || result.output;
            this.showOutput = true;
            console.log('📤 Code execution result received');
        });
    }

    private handleLocalCodeChange(event: any): void {
        const timestamp = Date.now();

        // Предотвратяваме спам от бързи промени
        if (timestamp - this.lastChangeTimestamp < 100) {
            return;
        }

        this.lastChangeTimestamp = timestamp;

        // Изпращаме промяната на другите потребители
        event.changes.forEach((change: any) => {
            const codeChange: CodeChange = {
                range: change.range,
                text: change.text,
                timestamp,
                userId: this.userId
            };

            this.ws.sendCodeChange(this.roomId, codeChange);
        });
    }

    private applyRemoteChange(change: CodeChange): void {
        this.isUpdatingRemotely = true;

        try {
            // Прилагаме промяната в editor-а
            const operation = {
                range: change.range,
                text: change.text
            };

            this.editor.executeEdits('remote-change', [operation]);
            console.log('✅ Applied remote code change');
        } catch (error) {
            console.error('❌ Failed to apply remote change:', error);
        } finally {
            // Възстановяваме local editing след малко
            setTimeout(() => {
                this.isUpdatingRemotely = false;
            }, 50);
        }
    }

    changeLanguage(event: any): void {
        const newLanguage = event.target.value;
        this.currentLanguage = newLanguage;

        // Променяме езика в editor-а
        monaco.editor.setModelLanguage(this.editor.getModel(), newLanguage);

        // Изпращаме промяната на другите потребители
        this.ws.sendLanguageChange(this.roomId, newLanguage, this.userId);

        console.log('🔄 Language changed to:', newLanguage);
    }

    runCode(): void {
        const code = this.editor.getValue();
        console.log('▶️ Running code...');

        // Изпращаме кода за изпълнение
        this.ws.sendCodeExecution(this.roomId, {
            code,
            language: this.currentLanguage,
            userId: this.userId
        });
    }

    canRunCode(): boolean {
        // Позволяваме изпълнение само на определени езици
        const runnableLanguages = ['javascript', 'python', 'java', 'cpp', 'csharp'];
        return runnableLanguages.includes(this.currentLanguage);
    }

    resetCode(): void {
        const initialCode = this.getInitialCode();
        this.editor.setValue(initialCode);

        // Изпращаме reset на другите потребители
        this.ws.sendCodeReset(this.roomId, initialCode, this.userId);

        console.log('🔄 Code reset');
    }

    closeOutput(): void {
        this.showOutput = false;
    }

    private getInitialCode(): string {
        const codeTemplates: Record<string, string> = {
            javascript: `// JavaScript Code
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,

            python: `# Python Code
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print("Fibonacci sequence:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,

            java: `// Java Code
public class Main {
    public static void main(String[] args) {
        System.out.println("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }

    static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}`,

            cpp: `// C++ Code
#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Fibonacci sequence:" << endl;
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    return 0;
}`,

            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Interview</title>
</head>
<body>
    <h1>Welcome to the Interview!</h1>
    <p>Good luck with your coding challenge.</p>
</body>
</html>`,

            css: `/* CSS Styles */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 10px;
    text-align: center;
}

.button {
    background: #4CAF50;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.button:hover {
    background: #45a049;
    transform: translateY(-2px);
}`
        };

        return codeTemplates[this.currentLanguage] || codeTemplates["javascript"];
    }

    private getUserColor(): string {
        // Генерираме цвят базиран на userId
        const hash = this.userId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);

        return this.userColors[Math.abs(hash) % this.userColors.length];
    }
}
