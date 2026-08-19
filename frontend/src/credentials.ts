/**
 * Выдача логинов и паролей для раздачи людям.
 *
 * Пароль видно ровно один раз — в базе лежит хэш, восстановить его нельзя, можно
 * только задать новый. Поэтому список нужно уметь и показать на экране, и
 * выгрузить файлом: на планшете начальника участка переписывать двадцать паролей
 * от руки — верный способ их потерять.
 *
 * Раньше это работало только после импорта из Excel. При добавлении сотрудника
 * по одному пароль взять было негде: администратор задавал его сам и должен был
 * держать в голове.
 */
export interface Credential {
  fullName: string;
  username: string;
  password: string;
}

export function downloadCredentials(credentials: Credential[], fileSuffix = ''): void {
  const rows = [
    'ФИО,Логин,Пароль',
    ...credentials.map((c) => `"${c.fullName}","${c.username}","${c.password}"`),
  ];
  // BOM — иначе Excel открывает кириллицу кракозябрами.
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logins${fileSuffix ? '_' + fileSuffix : ''}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
