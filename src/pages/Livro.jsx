import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPageUrl } from '@/utils'

export default function Livro() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(createPageUrl('RP'), { replace: true })
  }, [])

  return null
}
