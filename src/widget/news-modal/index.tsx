/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, createSignal, createEffect, onCleanup, For, Show } from 'solid-js'

import { Modal, Loading } from '../../component'
import newsService, { NewsArticle } from '../../NewsService'
import i18n from '../../i18n'

import './index.less'

interface NewsModalProps {
  locale: string
  visible: boolean
  symbol?: string
  onClose: () => void
}

const NewsModal: Component<NewsModalProps> = props => {
  const [articles, setArticles] = createSignal<NewsArticle[]>([])
  const [loading, setLoading] = createSignal(false)

  createEffect(() => {
    if (props.visible && props.symbol) {
      loadNews(props.symbol)
    }
  })

  const loadNews = async (symbol: string) => {
    setLoading(true)
    try {
      const news = await newsService.getNewsForSymbol(symbol, 20)
      setArticles(news)
    } catch (e) {
      console.error('Failed to load news:', e)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Show when={props.visible}>
      <Modal
        title={`${i18n('news', props.locale)} - ${props.symbol || ''}`}
        onClose={props.onClose}
        width={700}
      >
        <div class="klinecharts-pro-news-modal">
          <Show when={loading()}>
            <div class="loading-container">
              <Loading />
            </div>
          </Show>

          <Show when={!loading()}>
            <Show when={articles().length > 0} fallback={
              <div class="empty-state">
                <span>📰</span>
                <p>{i18n('no_news', props.locale)}</p>
              </div>
            }>
              <div class="news-list">
                <For each={articles()}>
                  {(article) => (
                    <a
                      class="news-item"
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Show when={article.imageUrl}>
                        <div class="news-image">
                          <img src={article.imageUrl} alt="" loading="lazy" />
                        </div>
                      </Show>
                      <div class="news-content">
                        <h4 class="news-title">{article.title}</h4>
                        <Show when={article.summary}>
                          <p class="news-summary">{article.summary.slice(0, 150)}...</p>
                        </Show>
                        <div class="news-meta">
                          <span class="news-source">{article.source}</span>
                          <span class="news-time">{newsService.formatRelativeTime(article.publishedAt)}</span>
                          <Show when={article.symbols.length > 0}>
                            <div class="news-symbols">
                              <For each={article.symbols.slice(0, 5)}>
                                {(sym) => <span class="symbol-tag">{sym}</span>}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </a>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Modal>
    </Show>
  )
}

export default NewsModal
