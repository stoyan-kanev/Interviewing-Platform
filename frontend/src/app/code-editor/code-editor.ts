import { Component, ElementRef, OnInit, OnDestroy, ViewChild, Input } from '@angular/core';
import { WebSocketService } from '../services/websocket';
import { CommonModule } from '@angular/common';

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
    templateUrl: './code-editor.html' ,
    styleUrls: ['./code-editor.css'],
    standalone: true,
    imports: [CommonModule]
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

    private userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

    constructor(private ws: WebSocketService) {}

    async ngOnInit() {
        console.log('🚀 Code editor initializing...', {
            roomId: this.roomId,
            userId: this.userId,
            userName: this.userName
        });

        await this.loadMonacoEditor();
        this.initializeEditor();
        this.setupWebSocketListeners();

        setTimeout(() => {
            console.log('👋 Joining code editor room...');
            this.ws.sendJoinCodeEditor(this.roomId, {
                id: this.userId,
                name: this.userName,
                color: this.getUserColor()
            });
        }, 500);
    }

    ngOnDestroy() {
        if (this.editor) {
            this.editor.dispose();
        }
        this.ws.sendLeaveCodeEditor(this.roomId, this.userId);
    }

    private async loadMonacoEditor(): Promise<void> {
        return new Promise((resolve) => {
            if (typeof (window as any).monaco !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js';
            script.onload = () => {
                (window as any).require.config({
                    paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }
                });

                (window as any).require(['vs/editor/editor.main'], () => {
                    console.log('📝 Monaco Editor loaded successfully');
                    resolve();
                });
            };
            script.onerror = () => {
                console.error('❌ Failed to load Monaco Editor');
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    private initializeEditor(): void {
        const initialCode = this.getInitialCode();

        this.editor = (window as any).monaco.editor.create(this.editorContainer.nativeElement, {
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

        this.editor.onDidChangeModelContent((event: any) => {
            if (!this.isUpdatingRemotely) {
                this.handleLocalCodeChange(event);
            }
        });

        console.log('📝 Monaco Editor initialized');
    }

    private setupWebSocketListeners(): void {
        console.log('🔧 Setting up WebSocket listeners for code editor');

        this.ws.onCodeChange().subscribe((change: CodeChange) => {
            console.log('📥 Code change received:', change);
            if (change.userId !== this.userId) {
                // Проверяваме дали това е code reset (цялостна замяна)
                if (change.range.startLineNumber === 1 &&
                    change.range.startColumn === 1 &&
                    change.range.endLineNumber === Number.MAX_SAFE_INTEGER) {
                    console.log('🔄 Applying code reset from remote user');
                    this.isUpdatingRemotely = true;
                    this.editor.setValue(change.text);
                    setTimeout(() => { this.isUpdatingRemotely = false; }, 100);
                } else {
                    this.applyRemoteChange(change);
                }
            }
        });

        this.ws.onLanguageChange().subscribe((data: {language: string, userId: string}) => {
            console.log('📥 Language change received:', data);
            if (data.userId !== this.userId) {
                this.currentLanguage = data.language;
                if (this.editor && (window as any).monaco) {
                    (window as any).monaco.editor.setModelLanguage(this.editor.getModel(), this.currentLanguage);
                    console.log('🔄 Language changed to:', this.currentLanguage);
                }
            }
        });

        this.ws.onCodeEditorUserJoined().subscribe((user: any) => {
            console.log('👋 Code editor user joined:', user);
            if (user.id !== this.userId) {
                this.activeUsers.push(user);
            }
        });

        this.ws.onCodeEditorUserLeft().subscribe((userId: string) => {
            console.log('👋 Code editor user left:', userId);
            this.activeUsers = this.activeUsers.filter(u => u.id !== userId);
        });

        this.ws.onCodeExecutionResult().subscribe((result: {output: string, error?: string}) => {
            console.log('📤 Code execution result received:', result);

            setTimeout(() => {
                this.outputContent = result.error || result.output || 'No output';
                this.showOutput = true;
                console.log('💻 Output panel updated:', {
                    content: this.outputContent,
                    visible: this.showOutput
                });
            }, 0);
        });
    }

    private handleLocalCodeChange(event: any): void {
        const timestamp = Date.now();

        if (timestamp - this.lastChangeTimestamp < 100) {
            return;
        }

        this.lastChangeTimestamp = timestamp;

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
            const operation = {
                range: change.range,
                text: change.text
            };

            this.editor.executeEdits('remote-change', [operation]);
            console.log('✅ Applied remote code change');
        } catch (error) {
            console.error('❌ Failed to apply remote change:', error);
        } finally {
            setTimeout(() => {
                this.isUpdatingRemotely = false;
            }, 50);
        }
    }

    changeLanguage(event: any): void {
        const newLanguage = event.target.value;
        console.log('🔄 Changing language from', this.currentLanguage, 'to', newLanguage);

        this.currentLanguage = newLanguage;

        if (!this.editor) {
            console.error('❌ Editor not initialized');
            return;
        }

        try {
            if ((window as any).monaco) {
                (window as any).monaco.editor.setModelLanguage(this.editor.getModel(), newLanguage);
                console.log('✅ Language model changed to:', newLanguage);
            }

            const newCode = this.getInitialCode();
            console.log('📝 Setting new code template for', newLanguage);

            this.isUpdatingRemotely = true;
            this.editor.setValue(newCode);

            setTimeout(() => {
                this.isUpdatingRemotely = false;
            }, 100);

            this.ws.sendLanguageChange(this.roomId, newLanguage, this.userId);
            this.ws.sendCodeReset(this.roomId, newCode, this.userId);

            console.log('✅ Language changed successfully to:', newLanguage);

        } catch (error) {
            console.error('❌ Error changing language:', error);
        }
    }

    runCode(): void {
        if (!this.editor) {
            console.error('❌ Editor not initialized');
            return;
        }

        const code = this.editor.getValue();
        console.log('▶️ Running code:', {
            language: this.currentLanguage,
            codeLength: code.length,
            roomId: this.roomId,
            userId: this.userId
        });

        this.ws.sendCodeExecution(this.roomId, {
            code,
            language: this.currentLanguage,
            userId: this.userId
        });
    }

    canRunCode(): boolean {
        // Позволяваме изпълнение само на определени езици
        const runnableLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp'];
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

    formatOutput(content: string): string {
        if (!content) return 'No output';

        return content.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
    }

    showTestOutput(): void {
        console.log('🧪 Testing output display...');
        this.outputContent = 'Test output\nLine 2\nLine 3';
        this.showOutput = true;
        console.log('Output state:', { content: this.outputContent, visible: this.showOutput });
    }

    private getInitialCode(): string {
        console.log('🎯 Getting initial code for language:', this.currentLanguage);

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

            typescript: `// TypeScript Code
interface Person {
    name: string;
    age: number;
}

function fibonacci(n: number): number {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

const person: Person = { name: "Developer", age: 25 };
console.log(\`Hello \${person.name}!\`);

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

            csharp: `// C# Code
using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Fibonacci sequence:");
        for (int i = 0; i < 10; i++)
        {
            Console.WriteLine($"F({i}) = {Fibonacci(i)}");
        }
    }

    static int Fibonacci(int n)
    {
        if (n <= 1) return n;
        return Fibonacci(n - 1) + Fibonacci(n - 2);
    }
}`,

            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Interview</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .highlight { background: #f0f8ff; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to the Interview!</h1>
        <div class="highlight">
            <p>Good luck with your coding challenge.</p>
            <p>Show us what you can do! 🚀</p>
        </div>
    </div>
</body>
</html>`,

            css: `/* CSS Styles */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 10px;
    text-align: center;
    margin-bottom: 2rem;
}

.button {
    background: #4CAF50;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 16px;
}

.button:hover {
    background: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    margin: 20px 0;
}`,

            sql: `-- SQL Query
SELECT
    e.employee_id,
    e.first_name,
    e.last_name,
    d.department_name,
    e.salary
FROM employees e
JOIN departments d ON e.department_id = d.department_id
WHERE e.salary > (
    SELECT AVG(salary)
    FROM employees
    WHERE department_id = e.department_id
)
ORDER BY e.salary DESC;

-- Create a simple table
CREATE TABLE fibonacci_numbers (
    position INT PRIMARY KEY,
    value INT NOT NULL
);

-- Insert some Fibonacci numbers
INSERT INTO fibonacci_numbers (position, value) VALUES
(0, 0), (1, 1), (2, 1), (3, 2), (4, 3),
(5, 5), (6, 8), (7, 13), (8, 21), (9, 34);`,

            json: `{
  "interview": {
    "candidate": {
      "name": "John Doe",
      "position": "Software Developer",
      "experience": "3 years",
      "skills": [
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
        "Python"
      ]
    },
    "questions": [
      {
        "id": 1,
        "type": "coding",
        "difficulty": "medium",
        "topic": "algorithms",
        "description": "Implement Fibonacci sequence"
      },
      {
        "id": 2,
        "type": "system-design",
        "difficulty": "hard",
        "topic": "scalability",
        "description": "Design a chat application"
      }
    ],
    "evaluation": {
      "technical_skills": 8,
      "problem_solving": 9,
      "communication": 7,
      "overall_rating": "strong_hire"
    }
  }
}`
        };

        const selectedCode = codeTemplates[this.currentLanguage] || codeTemplates['javascript'];
        console.log('📋 Selected template for', this.currentLanguage, ':', selectedCode.substring(0, 50) + '...');

        return selectedCode;
    }

    private getUserColor(): string {
        const hash = this.userId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);

        return this.userColors[Math.abs(hash) % this.userColors.length];
    }
}
