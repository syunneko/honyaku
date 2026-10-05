document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // Web Speech APIの確認
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert('お使いのブラウザは音声認識に対応していません。Chrome等の最新ブラウザをご利用ください。');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    // 多言語認識のために言語コードを設定（日本語・英語どちらも識別可能な設定）
    recognition.lang = 'ja-JP';

    // UI要素
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    const micIcon = document.getElementById('micIcon');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const waveContainer = document.getElementById('waveContainer');
    
    const transcriptArea = document.getElementById('transcriptArea');
    const translatedArea = document.getElementById('translatedArea');
    const charCount = document.getElementById('charCount');
    const translatedCharCount = document.getElementById('translatedCharCount');
    const translatingIndicator = document.getElementById('translatingIndicator');

    const sourceFlag = document.getElementById('sourceFlag');
    const sourceTitle = document.getElementById('sourceTitle');
    const targetFlag = document.getElementById('targetFlag');
    const targetTitle = document.getElementById('targetTitle');

    const copySourceBtn = document.getElementById('copySourceBtn');
    const copyTranslatedBtn = document.getElementById('copyTranslatedBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const toast = document.getElementById('toast');

    // 全画面表示用のUI要素
    const targetCard = document.getElementById('targetCard');
    const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');

    let isRecording = false;
    let finalTranscript = '';
    let translationDebounceTimer = null;

    // ★ 全画面表示の切り替え処理
    if (toggleFullscreenBtn && targetCard) {
        toggleFullscreenBtn.addEventListener('click', () => {
            const isFullscreen = targetCard.classList.toggle('fullscreen-mode');
            
            // アイコン切り替え (拡大: maximize-2 / 縮小: minimize-2)
            if (fullscreenIcon) {
                fullscreenIcon.setAttribute('data-lucide', isFullscreen ? 'minimize-2' : 'maximize-2');
                lucide.createIcons();
            }
        });

        // ESCキー押下で全画面モードを解除
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && targetCard.classList.contains('fullscreen-mode')) {
                targetCard.classList.remove('fullscreen-mode');
                if (fullscreenIcon) {
                    fullscreenIcon.setAttribute('data-lucide', 'maximize-2');
                    lucide.createIcons();
                }
            }
        });
    }

    // マイク切り替え
    toggleMicBtn.addEventListener('click', () => {
        if (!isRecording) {
            recognition.start();
        } else {
            recognition.stop();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        toggleMicBtn.classList.add('recording');
        statusBadge.classList.add('recording');
        statusText.textContent = '認識中... (日本語・英語を自動判別します)';
        waveContainer.classList.remove('hidden');
        micIcon.setAttribute('data-lucide', 'square');
        lucide.createIcons();
    };

    recognition.onend = () => {
        isRecording = false;
        toggleMicBtn.classList.remove('recording');
        statusBadge.classList.remove('recording');
        statusText.textContent = '待機中（マイクボタンを押してください）';
        waveContainer.classList.add('hidden');
        micIcon.setAttribute('data-lucide', 'mic');
        lucide.createIcons();
        finalTranscript = transcriptArea.value;
    };

    // リアルタイム音声認識結果
    recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + '\n';
            } else {
                interimTranscript += transcript;
            }
        }

        const currentText = finalTranscript + interimTranscript;
        transcriptArea.value = currentText;
        updateCounts();

        transcriptArea.scrollTop = transcriptArea.scrollHeight;

        // 言語判定と自動翻訳の実行（デバウンス時間を 1000ms → 350ms に短縮）
        clearTimeout(translationDebounceTimer);
        translationDebounceTimer = setTimeout(() => {
            if (currentText.trim()) {
                handleAutoDetectAndTranslate(currentText.trim());
            }
        }, 350); // ★ 0.35秒後に翻訳リクエストを実行して応答ラグを削減
    };

    recognition.onerror = (event) => {
        showToast(`エラーが発生しました: ${event.error}`);
        recognition.stop();
    };

    // 言語判定 ＆ 自動相互翻訳のメインロジック
    async function handleAutoDetectAndTranslate(text) {
        // 日本語文字列（ひらがな、カタカナ、漢字）を含むか判定
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);

        let sourceLang, targetLang;

        if (hasJapanese) {
            // 日本語が検出された場合 → 「日本語から英語へ翻訳」
            sourceLang = 'ja';
            targetLang = 'en';
            sourceFlag.textContent = '🇯🇵';
            sourceTitle.textContent = '音声入力 (日本語)';
            targetFlag.textContent = '🇺🇸';
            targetTitle.textContent = '翻訳結果 (英語)';
        } else {
            // 英語・その他アルファベットの場合 → 「英語から日本語へ翻訳」
            sourceLang = 'en';
            targetLang = 'ja';
            sourceFlag.textContent = '🇺🇸';
            sourceTitle.textContent = '音声入力 (英語)';
            targetFlag.textContent = '🇯🇵';
            targetTitle.textContent = '翻訳結果 (日本語)';
        }

        translatingIndicator.classList.remove('hidden');

        try {
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
            );
            const data = await response.json();

            if (data.responseData && data.responseData.translatedText) {
                translatedArea.value = data.responseData.translatedText;
                translatedArea.scrollTop = translatedArea.scrollHeight;
                updateCounts();
            }
        } catch (error) {
            console.error('Translation error:', error);
        } finally {
            translatingIndicator.classList.add('hidden');
        }
    }

    // 各種ボタンアクション
    copySourceBtn.addEventListener('click', () => {
        if (!transcriptArea.value.trim()) {
            showToast('コピーする原文がありません');
            return;
        }
        navigator.clipboard.writeText(transcriptArea.value)
            .then(() => showToast('原文をコピーしました！'));
    });

    copyTranslatedBtn.addEventListener('click', () => {
        if (!translatedArea.value.trim()) {
            showToast('コピーする翻訳結果がありません');
            return;
        }
        navigator.clipboard.writeText(translatedArea.value)
            .then(() => showToast('翻訳結果をコピーしました！'));
    });

    downloadBtn.addEventListener('click', () => {
        const text = `【原文】\n${transcriptArea.value}\n\n【翻訳結果】\n${translatedArea.value}`;
        if (!transcriptArea.value.trim() && !translatedArea.value.trim()) {
            showToast('保存するテキストがありません');
            return;
        }

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auto_translation_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('テキストと翻訳結果をクリアしますか？')) {
            finalTranscript = '';
            transcriptArea.value = '';
            translatedArea.value = '';
            sourceFlag.textContent = '🇯🇵/🇺🇸';
            sourceTitle.textContent = '音声入力（自動判定）';
            targetFlag.textContent = '🌐';
            targetTitle.textContent = '翻訳結果';
            updateCounts();
            showToast('クリアしました');
        }
    });

    transcriptArea.addEventListener('input', () => {
        finalTranscript = transcriptArea.value;
        updateCounts();
        if (transcriptArea.value.trim()) {
            // テキスト直接編集時のタイマーも350msに短縮
            clearTimeout(translationDebounceTimer);
            translationDebounceTimer = setTimeout(() => {
                handleAutoDetectAndTranslate(transcriptArea.value.trim());
            }, 350);
        }
    });

    function updateCounts() {
        charCount.textContent = `${transcriptArea.value.length} 文字`;
        translatedCharCount.textContent = `${translatedArea.value.length} 文字`;
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
});