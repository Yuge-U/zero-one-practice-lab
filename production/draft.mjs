import { uuid } from './core/model.mjs'; // コピー先には新しい明細IDを発行します。
export function draftErrors(input) { // 画面と試験で共用する保存前チェックです。
  const errors = []; // 利用者へ表示する入力箇所と理由を集めます。
  const add = (field, message, index = null) => errors.push({ field, message, index }); // 安全な文字列だけを返します。
  const required = (value, field, label, max, index = null) => { if (typeof value !== 'string' || !value.trim()) add(field, `${label}を入力してください。`, index); else if (value.length > max) add(field, `${label}は${max}文字以内にしてください。`, index); }; // 空白だけの入力も検出します。
  const integer = (value, field, label, min, max, index = null) => { const n = Number(value); if (String(value ?? '').trim() === '' || !Number.isSafeInteger(n) || n < min || n > max) add(field, `${label}は${min}〜${max}の整数にしてください。`, index); }; // iPhoneの数値欄もWorkerと同じ基準にします。
  required(input.title, 'title', '練習名', 120); required(input.goal, 'goal', '今日のゴール', 2000); required(input.team, 'team', '対象', 80); // 上部の必須項目を検査します。
  integer(input.players, 'players', '人数', 1, 100); integer(input.totalMinutes, 'totalMinutes', '全体の時間', 1, 600); // 人数と時間の範囲を検査します。
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) { add('items', '練習項目を1〜100件追加してください。'); return errors; } // 空の計画を確定せず次の操作を示します。
  for (const [index, item] of input.items.entries()) { // 練習項目ごとに具体的な場所を示します。
    required(item.name, 'name', `${index + 1}番目の練習項目名`, 160, index); integer(item.minutes, 'minutes', `${index + 1}番目の時間`, 1, 240, index); // 明細の基本条件を確認します。
    if (!['OPENING', 'BODY', 'CLOSING'].includes(item.section)) add('section', `${index + 1}番目の区分を選択してください。`, index); // 対応しない区分を受け入れません。
    if (item.variationName && String(item.variationName).length > 160) add('variationName', `${index + 1}番目のVariationは160文字以内にしてください。`, index); // 空欄時は既存モデルの基本条件を使用します。
    if (String(item.rule || '').length > 4000) add('rule', `${index + 1}番目の条件は4000文字以内にしてください。`, index); // 長過ぎる条件を保存前に案内します。
    if (!item.pinned && !item.term?.ID) add('termId', `${index + 1}番目の関連用語を選び直してください。`, index); // カタログ切替で無効になった関連を説明します。
  } // 明細チェックを終えます。
  const used = input.items.reduce((sum, item) => sum + Number(item.minutes), 0); // 明細の合計時間を求めます。
  if (Number.isFinite(used) && used > Number(input.totalMinutes)) add('totalMinutes', `練習項目の合計は${used}分です。全体の時間を増やすか、項目の時間を短くしてください。`); // 超過理由を画面上で明示します。
  return errors; // エラーがなければ保存へ進めます。
} // 保存前チェックを閉じます。
export function rowsFromDetail(detail, copy = false) { // 計画に固定された用語・作戦・条件を読み戻します。
  const payload = detail?.operation?.body?.payload; // 対象の練習計画を取り出します。
  if (!payload || !Array.isArray(payload.items)) throw new Error('コピー元の練習が見つかりません。'); // 不明な計画を空データで代用しません。
  const objects = new Map(detail.objects.map(object => [object.hash, object])); // 原文と固定版をハッシュで対応付けます。
  return payload.items.map(item => { // 各明細の参照を保持します。
    for (const field of ['termHash', 'canvasHash', 'drillHash', 'variationHash']) if (!objects.has(item[field])) throw new Error('コピーに必要な用語・作戦・条件が揃っていません。同期かバックアップ復元を確認してください。'); // 依存不足のコピーを保存させません。
    const term = objects.get(item.termHash).body.payload; const canvas = objects.get(item.canvasHash).body.payload; const drill = objects.get(item.drillHash).body.payload; const variation = objects.get(item.variationHash).body.payload; // 過去に使用した版を取得します。
    const parsed = JSON.parse(canvas.raw.replace(/^\uFEFF/, '')); const snapshot = parsed.snapshot || parsed; // ラッパーの有無に関係なく作戦名を読みます。
    return { id: copy ? uuid() : item.id, section: item.section || 'BODY', name: item.name, minutes: item.minutes, term: structuredClone(term.record), termId: term.id, catalogRevision: term.catalogRevision, purpose: drill.purpose || payload.goal, variationName: variation.name || '基本条件', rule: variation.rule || item.resolved?.rule || '', reason: variation.reason || '', canvasRaw: canvas.raw, canvasName: parsed.zeroOneNoDiagram ? '図なし' : snapshot.playName || '保存した作戦', canvasSource: canvas.source, pinned: structuredClone(item) }; // コピー時だけ新規IDを使い原本オブジェクトを変更しません。
  }); // 元の並び順で返します。
} // 固定版の読戻しを閉じます。
export function copyTitle(title) { return String(title).slice(0, 112).replace(/[\uD800-\uDBFF]$/, '') + '（コピー）'; } // 元の長いタイトルでも上限内に収まる名前にします。
