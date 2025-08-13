import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { StoreProvider } from '@store/context'
import Welcome from '@pages/Welcome'
import CategoryTreePage from '@pages/CategoryTreePage'
import AttributesPage from '@pages/AttributesPage'
import Nav from '@components/Nav'
import './styles.css'

function App() {
  return (
    <>
      <Nav />
      <div className="container">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/category-tree" element={<CategoryTreePage />} />
          <Route path="/attributes" element={<AttributesPage />} />
          <Route path="*" element={
            <div>
              <h2>Not found</h2>
              <Link to="/">Go home</Link>
            </div>
          } />
        </Routes>
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoreProvider>
  </React.StrictMode>
)
