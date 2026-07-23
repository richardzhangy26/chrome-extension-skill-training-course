/**
 * 从训练页 URL 提取训练任务 ID。
 * 普通能力训练页用 `trainTaskId`；能力训练 Pro 运行页用 `taskId`（实测）。
 * 优先 `trainTaskId`，回退 `taskId`，向后兼容普通页。
 */

const readTaskIdFromUrl = (url: string): string | null => {
  try {
    const params = new URL(url).searchParams;
    return params.get('trainTaskId') ?? params.get('taskId');
  } catch {
    return null;
  }
};

export { readTaskIdFromUrl };
