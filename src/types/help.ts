export type HelpCategory = 'overview' | 'goals' | 'math' | 'usage'

export interface HelpPage {
  category: HelpCategory
  heading: string
  body: string
  media: string
  credits?: string
}
