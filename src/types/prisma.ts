import type { Prisma } from "@prisma/client";

export type ClassWithRelations = Prisma.ClassGetPayload<{
  include: {
    students: {
      include: {
        student: true;
      };
    };
    schedules: true;
  };
}>;

export type ClassListItem = Prisma.ClassGetPayload<{
  include: {
    _count: {
      select: {
        students: true;
        schedules: true;
      };
    };
  };
}>;

export type StudentWithClasses = Prisma.StudentGetPayload<{
  include: {
    enrollments: {
      include: {
        class: true;
      };
    };
  };
}>;

export type ClassStudentWithRelations = Prisma.ClassStudentGetPayload<{
  include: {
    student: true;
    class: true;
  };
}>;

export type ClassStudentWithStudent = Prisma.ClassStudentGetPayload<{
  include: {
    student: true;
  };
}>;
