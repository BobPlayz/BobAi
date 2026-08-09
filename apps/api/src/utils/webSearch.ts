export async function webSearch(query: string) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.AbstractText) return data.AbstractText;
    if (data.Answer) return data.Answer;

    if (data.RelatedTopics?.length) {
      const first = data.RelatedTopics[0];
      if (first.Text) return first.Text;
      if (first.Topics?.length && first.Topics[0].Text) return first.Topics[0].Text;
    }

    return "";
  } catch {
    return "";
  }
}