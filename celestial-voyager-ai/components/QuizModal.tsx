
import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface Props {
    questions: QuizQuestion[];
    onClose: (score: number, total: number) => void;
    poiCount: number;
}

const QuizModal: React.FC<Props> = ({ questions, onClose, poiCount }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [quizComplete, setQuizComplete] = useState(false);

    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    const handleAnswerSelect = (answerIndex: number) => {
        if (showFeedback) return; // Prevent changing answer after selection

        setSelectedAnswer(answerIndex);
        setShowFeedback(true);

        // Update score if correct
        if (answerIndex === currentQuestion.correctAnswer) {
            setScore(prev => prev + 1);
        }
    };

    const handleNext = () => {
        if (isLastQuestion) {
            setQuizComplete(true);
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setShowFeedback(false);
        }
    };

    const getButtonStyle = (index: number) => {
        if (!showFeedback) {
            return selectedAnswer === index
                ? 'bg-cyan-600 border-cyan-400 text-white'
                : 'bg-slate-900/80 border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/40';
        }

        // Show feedback colors
        if (index === currentQuestion.correctAnswer) {
            return 'bg-green-600 border-green-400 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]';
        }
        if (index === selectedAnswer && index !== currentQuestion.correctAnswer) {
            return 'bg-red-600 border-red-400 text-white';
        }
        return 'bg-slate-900/60 border-slate-700 text-slate-500';
    };

    if (quizComplete) {
        const percentage = Math.round((score / questions.length) * 100);
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
                <div className="bg-slate-950 border-2 border-cyan-500 rounded-lg p-8 max-w-md w-full mx-4 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                    <div className="text-center">
                        <div className="mb-6">
                            <div className="text-6xl font-black text-cyan-400 mb-2">{percentage}%</div>
                            <div className="text-2xl font-black text-white mb-1">SECTOR ANALYSIS COMPLETE</div>
                            <div className="text-sm text-slate-400 font-mono">
                                {score} / {questions.length} Correct
                            </div>
                        </div>

                        <div className="mb-6 p-4 bg-cyan-950/20 border border-cyan-800 rounded">
                            <div className="text-xs text-cyan-400 uppercase tracking-wider mb-1">Mission Summary</div>
                            <div className="text-sm text-white">
                                {poiCount} Celestial objects explored and analyzed
                            </div>
                        </div>

                        {percentage >= 80 && (
                            <div className="mb-4 p-3 bg-green-950/30 border border-green-600/50 rounded">
                                <div className="text-green-400 font-bold text-sm">🎯 EXCELLENT RECONNAISSANCE</div>
                                <div className="text-xs text-green-300/70">Neural map sync optimal</div>
                            </div>
                        )}

                        {percentage >= 50 && percentage < 80 && (
                            <div className="mb-4 p-3 bg-blue-950/30 border border-blue-600/50 rounded">
                                <div className="text-blue-400 font-bold text-sm">✓ MISSION SUCCESSFUL</div>
                                <div className="text-xs text-blue-300/70">Good analysis depth</div>
                            </div>
                        )}

                        {percentage < 50 && (
                            <div className="mb-4 p-3 bg-amber-950/30 border border-amber-600/50 rounded">
                                <div className="text-amber-400 font-bold text-sm">⚠ PARTIAL DATA CAPTURE</div>
                                <div className="text-xs text-amber-300/70">Review sector data recommended</div>
                            </div>
                        )}

                        <button
                            onClick={() => onClose(score, questions.length)}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm uppercase tracking-wider rounded transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)]"
                        >
                            Continue Exploring
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in">
            <div className="bg-slate-950 border-2 border-cyan-500 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                {/* Header */}
                <div className="mb-6 border-b border-cyan-900 pb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-black text-cyan-400 uppercase tracking-tight">
                            Sector Knowledge Assessment
                        </h2>
                        <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded border border-slate-700">
                            Question {currentQuestionIndex + 1} / {questions.length}
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        {questions.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx < currentQuestionIndex
                                    ? 'bg-green-500'
                                    : idx === currentQuestionIndex
                                        ? 'bg-cyan-400 animate-pulse'
                                        : 'bg-slate-800'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Question */}
                <div className="mb-6">
                    {currentQuestion.relatedPOI && (
                        <div className="inline-block mb-3 px-3 py-1 bg-cyan-900/30 border border-cyan-700 rounded text-xs text-cyan-300 font-mono">
                            Related: {currentQuestion.relatedPOI}
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-white leading-relaxed">
                        {currentQuestion.question}
                    </h3>
                </div>

                {/* Answer Options */}
                <div className="space-y-3 mb-6">
                    {currentQuestion.options.map((option, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleAnswerSelect(idx)}
                            disabled={showFeedback}
                            className={`w-full p-4 rounded border-2 text-left transition-all duration-300 font-medium ${getButtonStyle(
                                idx
                            )} ${!showFeedback && 'cursor-pointer active:scale-[0.98]'} ${showFeedback && 'cursor-default'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-black opacity-60">
                                    {String.fromCharCode(65 + idx)}
                                </span>
                                <span>{option}</span>
                                {showFeedback && idx === currentQuestion.correctAnswer && (
                                    <span className="ml-auto text-lg">✓</span>
                                )}
                                {showFeedback &&
                                    idx === selectedAnswer &&
                                    idx !== currentQuestion.correctAnswer && (
                                        <span className="ml-auto text-lg">✗</span>
                                    )}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Feedback & Next Button */}
                {showFeedback && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                        {selectedAnswer === currentQuestion.correctAnswer ? (
                            <div className="mb-4 p-4 bg-green-950/30 border border-green-600 rounded">
                                <div className="text-green-400 font-bold mb-1">✓ Correct!</div>
                                <div className="text-sm text-green-200/80">Excellent analysis.</div>
                            </div>
                        ) : (
                            <div className="mb-4 p-4 bg-red-950/30 border border-red-600 rounded">
                                <div className="text-red-400 font-bold mb-1">✗ Incorrect</div>
                                <div className="text-sm text-red-200/80">
                                    The correct answer is: {currentQuestion.options[currentQuestion.correctAnswer]}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleNext}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm uppercase tracking-wider rounded transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                        >
                            {isLastQuestion ? 'View Results' : 'Next Question →'}
                        </button>
                    </div>
                )}

                {/* Score Display */}
                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-500">
                    <div>Current Score: {score} / {currentQuestionIndex + (showFeedback ? 1 : 0)}</div>
                    <div className="text-cyan-400">POIs Explored: {poiCount}</div>
                </div>
            </div>
        </div>
    );
};

export default QuizModal;
