import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { RequireAdmin, RequireAuth } from './components/guards'
import { Layout } from './components/layout'
import {
  AdminCoursesPage,
  AdminDashboardPage,
  AdminUsersPage,
  EditCoursePage,
  NewCoursePage,
} from './pages/admin'
import { LoginPage, SignupPage } from './pages/auth'
import { CourseDetailPage } from './pages/course-detail'
import { CoursesPage } from './pages/courses'
import { HomePage } from './pages/home'
import { CourseContentPage, PlayerPage, PurchasesPage } from './pages/learning'
import { ProfilePage } from './pages/profile'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:slug" element={<CourseDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />

          <Route element={<RequireAuth />}>
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="courses/:slug/content"
              element={<CourseContentPage />}
            />
            <Route
              path="courses/:slug/content/:videoId"
              element={<PlayerPage />}
            />
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/courses" element={<AdminCoursesPage />} />
            <Route path="admin/courses/new" element={<NewCoursePage />} />
            <Route path="admin/courses/:id" element={<EditCoursePage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
