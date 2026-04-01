import logoImg from '../assets/logo.png'

export default function SentinelaLogo({ size = 32, className = '' }) {
  return (
    <img
      src={logoImg}
      alt="Nexus Forge"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
