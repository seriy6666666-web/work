import { useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/**
 * Общий слой интерфейса.
 *
 * Смысл ровно один: чтобы вид системы задавался в одном месте, а не в тридцати
 * пяти файлах страниц. Сами детали намеренно тонкие — они не берут на себя
 * поведение, только внешний вид и отклик на нажатие.
 *
 * Оформление живёт в ui.css классами, а не встроенными стилями: встроенные не
 * умеют ни наведения, ни фокуса, ни нажатого состояния — а без них в цеху
 * непонятно, сработало или нет.
 */

type Div = { children?: ReactNode; className?: string; style?: React.CSSProperties };

function cls(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className, style }: Div) {
  return (
    <div className={cls('ui-card', className)} style={style}>
      {children}
    </div>
  );
}

/**
 * Таблица в своей панели.
 *
 * Раньше всё содержимое страницы лежало в одной общей белой коробке, и разные по
 * смыслу блоки — форма, подсказка, список — склеивались в одно пятно. Коробку
 * убрали; панель теперь принадлежит самой таблице, и заодно она же даёт
 * прокрутку вбок на узком экране, не ломая страницу.
 */
export function Table({ children, className, style }: Div) {
  return (
    <div className="ui-panel">
      <table className={cls('ui-table', className)} style={style}>
        {children}
      </table>
    </div>
  );
}

/**
 * Кнопки-фильтры со счётчиками.
 *
 * Один вид на все списки. Счётчики считаются по всему списку, а не по выбранному
 * фильтру: иначе «Без нормы 65» пропадало бы, стоило выбрать другой фильтр, и
 * понять, есть ли вообще операции без нормы, было бы нельзя.
 */
export function FilterChips<K extends string>({
  options,
  value,
  counts,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  counts: Record<K, number>;
  onChange: (key: K) => void;
}) {
  return (
    <div className="ui-chips">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={cls('ui-chip', value === o.key && 'ui-chip--on')}
          onClick={() => onChange(o.key)}
        >
          {o.label} <span className="ui-chip-count">{counts[o.key]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Форма создания, спрятанная под кнопку.
 *
 * Формы на этих экранах нужны раз в неделю, а стояли открытыми всегда и
 * отодвигали список, ради которого на экран заходят каждый день. Кнопка
 * возвращает верх экрана списку и не отнимает возможность добавить.
 */
export function CreateBlock({
  label,
  children,
  toolbar,
}: {
  /** Надпись на кнопке: «+ Материал», «+ Задача». */
  label: string;
  children?: ReactNode;
  /** Что стоит слева от кнопки — поиск, фильтры, выбор даты. */
  toolbar?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ui-create-row">
        {toolbar}
        <button
          type="button"
          className="ui-btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Свернуть' : label}
        </button>
      </div>
      {open && <div className="ui-panel ui-create-panel">{children}</div>}
    </>
  );
}

/** Панель: белый прямоугольник, на котором живёт один блок по смыслу. */
export function Panel({ children, className, style }: Div) {
  return (
    <div className={cls('ui-panel', className)} style={style}>
      {children}
    </div>
  );
}

export function Th({
  align,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return <th className={cls('ui-th', align === 'right' && 'ui-th--right', className)} {...rest} />;
}

export function Td({
  align,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' }) {
  return <td className={cls('ui-td', align === 'right' && 'ui-td--right', className)} {...rest} />;
}

/**
 * Кнопка.
 *
 * `primary` — основное действие на экране, «Добавить», «Назначить».
 * `ghost` — второстепенное рядом с основным.
 * `danger` — удаление и прочее необратимое.
 */
export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={cls('ui-btn', variant !== 'primary' && `ui-btn--${variant}`, className)}
      {...rest}
    />
  );
}

/** Действие внутри строки таблицы: «Изменить», «Удалить». */
export function LinkButton({
  danger,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={cls('ui-link', danger && 'ui-link--danger', className)}
      {...rest}
    />
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cls('ui-input', className)} {...rest} />;
}

/** Пояснение под заголовком страницы. */
export function Hint({ children, className, style }: Div) {
  return (
    <p className={cls('ui-hint', className)} style={style}>
      {children}
    </p>
  );
}

/** Приглушённый текст: подписи, вторичные числа. */
export function Muted({ children, className, style }: Div) {
  return (
    <span className={cls('ui-muted', className)} style={style}>
      {children}
    </span>
  );
}

/** Строка полей над списком: форма добавления, набор фильтров. */
export function FormRow({ children, className, style }: Div) {
  return (
    <div className={cls('ui-form-row', className)} style={style}>
      {children}
    </div>
  );
}

/** Имя с кружком инициалов в ячейке таблицы. */
export function NameCell({ children, className, style }: Div) {
  return (
    <div className={cls('ui-name-cell', className)} style={style}>
      {children}
    </div>
  );
}
