import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) headers.set('authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Attendance', 'Overtime', 'Users'],
  endpoints: (builder) => ({
    login: builder.mutation({ query: (body) => ({ url: '/auth/login', method: 'POST', body }) }),
    signup: builder.mutation({ query: (body) => ({ url: '/auth/signup', method: 'POST', body }) }),
    getUsers: builder.query({ query: () => '/auth/users', providesTags: ['Users'] }),
    addUser: builder.mutation({ query: (body) => ({ url: '/auth/users', method: 'POST', body }), invalidatesTags: ['Users'] }),
    getMyAttendance: builder.query({ query: () => '/attendance/my-attendance', providesTags: ['Attendance'] }),
    getAllAttendance: builder.query({ query: (params) => ({ url: '/attendance/all', params }), providesTags: ['Attendance'] }),
    punchIn: builder.mutation({ query: (body) => ({ url: '/attendance/punch-in', method: 'POST', body }), invalidatesTags: ['Attendance'] }),
    punchOut: builder.mutation({ query: (body) => ({ url: '/attendance/punch-out', method: 'POST', body }), invalidatesTags: ['Attendance'] }),
    getMyOvertime: builder.query({ query: () => '/overtime/my', providesTags: ['Overtime'] }),
    getOvertime: builder.query({ query: () => '/overtime/all', providesTags: ['Overtime'] }),
    requestOvertime: builder.mutation({ query: (body) => ({ url: '/overtime/request', method: 'POST', body }), invalidatesTags: ['Overtime', 'Attendance'] }),
    reviewOvertime: builder.mutation({ query: ({ id, ...body }) => ({ url: `/overtime/${id}`, method: 'PUT', body }), invalidatesTags: ['Overtime', 'Attendance'] }),
    reviewAttendance: builder.mutation({ query: ({ id, ...body }) => ({ url: `/attendance/validate/${id}`, method: 'PUT', body }), invalidatesTags: ['Attendance'] }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useGetUsersQuery,
  useAddUserMutation,
  useGetMyAttendanceQuery,
  useGetAllAttendanceQuery,
  usePunchInMutation,
  usePunchOutMutation,
  useGetMyOvertimeQuery,
  useGetOvertimeQuery,
  useRequestOvertimeMutation,
  useReviewOvertimeMutation,
  useReviewAttendanceMutation,
} = api;
