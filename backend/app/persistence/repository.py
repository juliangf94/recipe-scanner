from abc import ABC, abstractmethod


class BaseRepository(ABC):

    @abstractmethod
    def get_all(self):
        pass

    @abstractmethod
    def get_by_id(self, obj_id):
        pass

    @abstractmethod
    def get_by_attribute(self, attr_name, attr_value):
        pass

    @abstractmethod
    def save(self, obj):
        pass

    @abstractmethod
    def update(self, obj):
        pass

    @abstractmethod
    def delete(self, obj_id):
        pass


class InMemoryStorage(BaseRepository):

    def __init__(self):
        self._storage = {}

    def get_all(self):
        return list(self._storage.values())

    def get_by_id(self, obj_id):
        return self._storage.get(obj_id)

    def get_by_attribute(self, attr_name, attr_value):
        return next(
            (obj for obj in self._storage.values()
             if getattr(obj, attr_name) == attr_value),
            None
        )

    def save(self, obj):
        self._storage[obj.id] = obj
        return obj

    def update(self, obj):
        self._storage[obj.id] = obj
        return obj

    def delete(self, obj_id):
        self._storage.pop(obj_id, None)
