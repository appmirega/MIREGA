import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, ChevronDown, ChevronUp, AlertCircle, Save } from 'lucide-react';
import { PhotoCapture } from './PhotoCapture';

interface Question {
  id: string;
  question_number: number;
  section: string;
  question_text: string;
  frequency: 'M' | 'T' | 'S';
  is_hydraulic_only: boolean;
}

interface Answer {
  question_id: string;
  status: 'approved' | 'rejected' | 'pending';
  observations: string;
  photo_1_url: string | null;
  photo_2_url: string | null;
}

interface DynamicChecklistFormProps {
  checklistId: string;
  elevatorId: string;
  isHydraulic: boolean;
  month: number;
  onComplete: () => void;
  onSave: () => void;
}

export function DynamicChecklistForm({
  checklistId,
  elevatorId,
  isHydraulic,
  month,
  onComplete,
  onSave,
}: DynamicChecklistFormProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changeCount, setChangeCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    loadQuestionsAndAnswers();
  }, [checklistId, month, isHydraulic]);

  useEffect(() => {
    if (changeCount > 0 && changeCount % 5 === 0) {
      handleAutoSave();
    }
  }, [changeCount]);

  const loadQuestionsAndAnswers = async () => {
    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from('mnt_checklist_questions')
        .select('*')
        .order('question_number');

      if (questionsError) throw questionsError;

      const filteredQuestions = filterQuestionsByFrequency(questionsData || [], month, isHydraulic);
      setQuestions(filteredQuestions);

      const { data: answersData, error: answersError } = await supabase
        .from('mnt_checklist_answers')
        .select('*')
        .eq('checklist_id', checklistId);

      if (answersError) throw answersError;

      const answersMap = new Map<string, Answer>();
      answersData?.forEach((answer) => {
        answersMap.set(answer.question_id, {
          question_id: answer.question_id,
          status: answer.status,
          observations: answer.observations || '',
          photo_1_url: answer.photo_1_url,
          photo_2_url: answer.photo_2_url,
        });
      });
      setAnswers(answersMap);

      const sections = new Set(filteredQuestions.map(q => q.section));
      setExpandedSections(sections);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterQuestionsByFrequency = (allQuestions: Question[], currentMonth: number, hydraulic: boolean) => {
    const quarters = [3, 6, 9, 12];
    const semesters = [3, 9];

    return allQuestions.filter((q) => {
      if (q.is_hydraulic_only && !hydraulic) return false;

      if (q.frequency === 'M') return true;
      if (q.frequency === 'T') return quarters.includes(currentMonth);
      if (q.frequency === 'S') return semesters.includes(currentMonth);

      return false;
    });
  };

  const handleAnswerChange = (questionId: string, status: 'approved' | 'rejected') => {
    const currentAnswer = answers.get(questionId) || {
      question_id: questionId,
      status: 'pending',
      observations: '',
      photo_1_url: null,
      photo_2_url: null,
    };

    const newAnswer: Answer = {
      ...currentAnswer,
      status,
      observations: status === 'approved' ? '' : currentAnswer.observations,
      photo_1_url: status === 'approved' ? null : currentAnswer.photo_1_url,
      photo_2_url: status === 'approved' ? null : currentAnswer.photo_2_url,
    };

    setAnswers(new Map(answers.set(questionId, newAnswer)));
    setChangeCount(prev => prev + 1);
  };

  const handleObservationsChange = (questionId: string, observations: string) => {
    const currentAnswer = answers.get(questionId);
    if (!currentAnswer) return;

    setAnswers(new Map(answers.set(questionId, { ...currentAnswer, observations })));
    setChangeCount(prev => prev + 1);
  };

  const handlePhotosChange = (questionId: string, photo1: string | null, photo2: string | null) => {
    const currentAnswer = answers.get(questionId);
    if (!currentAnswer) return;

    setAnswers(
      new Map(
        answers.set(questionId, {
          ...currentAnswer,
          photo_1_url: photo1,
          photo_2_url: photo2,
        })
      )
    );
    setChangeCount(prev => prev + 1);
  };

  const handleAutoSave = async () => {
    await saveAnswers(true);
  };

  const handleManualSave = async () => {
    await saveAnswers(false);
  };

  const saveAnswers = async (isAutoSave: boolean = false) => {
    setSaving(true);
    try {
      const answersToSave = Array.from(answers.values()).map((answer) => ({
        checklist_id: checklistId,
        question_id: answer.question_id,
        status: answer.status,
        observations: answer.observations,
        photo_1_url: answer.photo_1_url,
        photo_2_url: answer.photo_2_url,
      }));

      for (const answer of answersToSave) {
        const { error } = await supabase
          .from('mnt_checklist_answers')
          .upsert(answer, {
            onConflict: 'checklist_id,question_id',
          });

        if (error) throw error;
      }

      if (isAutoSave) {
        const { error: updateError } = await supabase
          .from('mnt_checklists')
          .update({
            auto_save_count: supabase.rpc('increment', { x: 1 }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', checklistId);

        if (updateError) console.error('Error updating auto_save_count:', updateError);
      }

      setLastSaved(new Date());
      if (!isAutoSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving answers:', error);
      alert('Error al guardar las respuestas');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const groupQuestionsBySection = () => {
    const grouped = new Map<string, Question[]>();
    questions.forEach((q) => {
      const existing = grouped.get(q.section) || [];
      grouped.set(q.section, [...existing, q]);
    });
    return grouped;
  };

  const getProgress = () => {
    const total = questions.length;
    const answered = Array.from(answers.values()).filter((a) => a.status !== 'pending').length;
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  };

  const canComplete = () => {
    const allAnswered = questions.every((q) => {
      const answer = answers.get(q.id);
      if (!answer || answer.status === 'pending') return false;

      if (answer.status === 'rejected') {
        return (
          answer.observations.trim() !== '' &&
          answer.photo_1_url !== null &&
          answer.photo_2_url !== null
        );
      }

      return true;
    });

    return allAnswered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const progress = getProgress();
  const sectionedQuestions = groupQuestionsBySection();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Checklist de Mantenimiento</h2>
            <p className="text-sm text-slate-600">
              {progress.answered} de {progress.total} preguntas respondidas ({progress.percentage}%)
            </p>
          </div>
          <div className="text-right">
            {lastSaved && (
              <p className="text-xs text-slate-500">
                Guardado: {lastSaved.toLocaleTimeString('es-ES')}
              </p>
            )}
            {changeCount > 0 && changeCount % 5 !== 0 && (
              <p className="text-xs text-amber-600">
                {5 - (changeCount % 5)} cambios para autoguardar
              </p>
            )}
          </div>
        </div>

        <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={onComplete}
            disabled={!canComplete() || saving}
            className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Completar Checklist
          </button>
        </div>
      </div>

      {Array.from(sectionedQuestions.entries()).map(([section, sectionQuestions]) => {
        const isExpanded = expandedSections.has(section);
        const sectionAnswered = sectionQuestions.filter((q) => {
          const answer = answers.get(q.id);
          return answer && answer.status !== 'pending';
        }).length;

        return (
          <div key={section} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              onClick={() => toggleSection(section)}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-4">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-slate-900">{section}</h3>
                  <p className="text-sm text-slate-600">
                    {sectionAnswered} de {sectionQuestions.length} completadas
                  </p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {isExpanded && (
              <div className="divide-y divide-slate-200">
                {sectionQuestions.map((question) => {
                  const answer = answers.get(question.id);
                  const status = answer?.status || 'pending';

                  return (
                    <div key={question.id} className="p-6 bg-slate-50">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 text-sm">
                          {question.question_number}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 mb-3">{question.question_text}</p>

                          <div className="flex gap-3 mb-4">
                            <button
                              onClick={() => handleAnswerChange(question.id, 'approved')}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition ${
                                status === 'approved'
                                  ? 'bg-green-600 text-white shadow-lg'
                                  : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-green-500'
                              }`}
                            >
                              <Check className="w-5 h-5" />
                              Aprobado
                            </button>
                            <button
                              onClick={() => handleAnswerChange(question.id, 'rejected')}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition ${
                                status === 'rejected'
                                  ? 'bg-red-600 text-white shadow-lg'
                                  : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-red-500'
                              }`}
                            >
                              <X className="w-5 h-5" />
                              Rechazado
                            </button>
                          </div>

                          {status === 'rejected' && (
                            <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                              <div>
                                <label className="block text-sm font-semibold text-red-900 mb-2">
                                  Observaciones (Obligatorias)
                                </label>
                                <textarea
                                  value={answer?.observations || ''}
                                  onChange={(e) => handleObservationsChange(question.id, e.target.value)}
                                  placeholder="Describe el problema encontrado..."
                                  rows={3}
                                  className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                              </div>

                              <PhotoCapture
                                questionId={question.id}
                                checklistId={checklistId}
                                existingPhotos={{
                                  photo1: answer?.photo_1_url || undefined,
                                  photo2: answer?.photo_2_url || undefined,
                                }}
                                onPhotosChange={(photo1, photo2) => handlePhotosChange(question.id, photo1, photo2)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!canComplete() && progress.answered > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Checklist Incompleto</p>
            <p className="text-sm text-amber-800">
              Todas las preguntas rechazadas deben incluir observaciones y 2 fotografías.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
