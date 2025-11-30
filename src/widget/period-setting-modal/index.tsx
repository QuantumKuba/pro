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

import { Component, createSignal } from 'solid-js'

import { Modal, Select, Input } from '../../component'
import type { SelectDataSourceItem } from '../../component'
import i18n from '../../i18n'
import { Period } from '../../types'

export interface PeriodSettingModalProps {
  locale: string
  onClose: () => void
  onConfirm: (period: Period) => void
}

const PeriodSettingModal: Component<PeriodSettingModalProps> = props => {
  const [span, setSpan] = createSignal(1)
  const [type, setType] = createSignal<SelectDataSourceItem>({ key: 'minute', text: i18n('minute', props.locale) })

  const types = [
    { key: 'minute', text: i18n('minute', props.locale) },
    { key: 'hour', text: i18n('hour', props.locale) },
    { key: 'day', text: i18n('day', props.locale) },
    { key: 'week', text: i18n('week', props.locale) },
    { key: 'month', text: i18n('month', props.locale) },
    { key: 'year', text: i18n('year', props.locale) }
  ]

  return (
    <Modal
      title={i18n('custom_period', props.locale)}
      width={320}
      buttons={[
        {
          children: i18n('confirm', props.locale),
          onClick: () => {
            const t = type().key
            const s = span()
            let text = ''
            switch (t) {
              case 'minute': text = `${s}m`; break
              case 'hour': text = `${s}H`; break
              case 'day': text = `${s}D`; break
              case 'week': text = `${s}W`; break
              case 'month': text = `${s}M`; break
              case 'year': text = `${s}Y`; break
            }
            props.onConfirm({ span: s, type: t as any, text })
            props.onClose()
          }
        }
      ]}
      onClose={props.onClose}>
      <div style={{ display: 'flex', 'flex-direction': 'row', 'align-items': 'center', 'margin-top': '20px' }}>
        <Input
          style={{ flex: 1, 'margin-right': '10px' }}
          value={span()}
          precision={0}
          min={1}
          onChange={(v) => { setSpan(v as number) }}/>
        <Select
          style={{ width: '100px' }}
          value={type().text}
          dataSource={types}
          onSelected={(item) => { setType(item as SelectDataSourceItem) }}/>
      </div>
    </Modal>
  )
}

export default PeriodSettingModal
