export function Html({ html, class: cls = 'prose' }: { html: string; class?: string }) {
  return <div class={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
