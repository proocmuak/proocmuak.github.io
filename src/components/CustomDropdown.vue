<template>
  <div class="custom-dropdown" :class="{ 'is-open': isOpen, 'is-disabled': disabled }">
    <div 
      class="dropdown-header"
      @click="toggleDropdown"
      :class="{ 'has-selection': hasSelection }"
    >
      <span class="selected-value">
        {{ displayValue || placeholder }}
      </span>
      <span class="dropdown-arrow">▼</span>
    </div>
    
    <transition name="dropdown">
      <div 
        class="dropdown-options-container"
        v-show="isOpen && !disabled"
        @click.stop
      >
        <!-- Поле поиска -->
        <div class="dropdown-search" v-if="searchable">
          <input
            type="text"
            v-model="searchQuery"
            @click.stop
            placeholder="Поиск..."
            class="search-input"
          />
        </div>

        <!-- Опции -->
        <div class="dropdown-options">
          <div
            v-for="option in filteredOptions"
            :key="option.value || option"
            class="dropdown-option"
            @click="selectOption(option)"
            :class="{ 
              'is-selected': isSelected(option),
              'is-multi-selected': multiple && isSelected(option)
            }"
          >
            <span class="checkbox" v-if="multiple">
              <span class="checkbox-inner" v-if="isSelected(option)">✓</span>
            </span>
            {{ option.label || option }}
          </div>

          <div class="no-results" v-if="filteredOptions.length === 0">
            Ничего не найдено
          </div>
        </div>

        <!-- Выбранные элементы (для множественного выбора) -->
        <div class="selected-tags" v-if="multiple && selectedOptions.length > 0">
          <div class="selected-tag" v-for="option in selectedOptions" :key="option.value || option">
            {{ option.label || option }}
            <span class="remove-tag" @click.stop="removeOption(option)">×</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'CustomDropdown',
  props: {
    options: {
      type: Array,
      required: true
    },
    placeholder: {
      type: String,
      default: 'Выберите'
    },
    modelValue: {
      type: [String, Number, Object, Array],
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
    searchable: {
      type: Boolean,
      default: false
    },
    multiple: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isOpen: false,
      searchQuery: '',
      internalValue: this.multiple 
      ? (Array.isArray(this.modelValue) ? [...this.modelValue] : [])
      : this.modelValue
    };
  },
  computed: {
    processedOptions() {
      return this.options.map(option => {
        return typeof option === 'object' ? option : { value: option, label: option };
      });
    },
    filteredOptions() {
      if (!this.searchQuery) return this.processedOptions;
      
      const query = this.searchQuery.toLowerCase();
      return this.processedOptions.filter(option => {
        const text = (option.label || option.value || option).toString().toLowerCase();
        return text.includes(query);
      });
    },
    hasSelection() {
      if (this.multiple) {
        return this.internalValue.length > 0;
      }
      return !!this.internalValue;
    },
    displayValue() {
      if (this.multiple) {
        if (this.internalValue.length === 0) return '';
        if (this.internalValue.length === 1) {
          const option = this.processedOptions.find(opt => 
            opt.value === this.internalValue[0] || opt === this.internalValue[0]
          );
          return option ? (option.label || option.value) : this.internalValue[0];
        }
        return `Выбрано: ${this.internalValue.length}`;
      } else {
        if (!this.internalValue) return '';
        const found = this.processedOptions.find(opt => 
          opt.value === this.internalValue || opt === this.internalValue
        );
        return found ? (found.label || found.value) : this.internalValue;
      }
    },
    selectedOptions() {
      if (!this.multiple) return [];
      return this.internalValue.map(value => {
        return this.processedOptions.find(opt => 
          opt.value === value || opt === value
        ) || value;
      });
    }
  },
  watch: {
    modelValue(newVal) {
      if (this.multiple) {
        this.internalValue = Array.isArray(newVal) ? [...newVal] : [];
      } else {
        this.internalValue = newVal;
      }
    }
  },
  methods: {
    toggleDropdown() {
      if (this.disabled) return;
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.$nextTick(() => {
          const searchInput = this.$el.querySelector('.search-input');
          if (searchInput) searchInput.focus();
        });
      } else {
        this.searchQuery = '';
      }
    },
    selectOption(option) {
      const value = option.value || option;
      
      if (this.multiple) {
        const index = this.internalValue.findIndex(v => v === value);
        if (index >= 0) {
          this.internalValue.splice(index, 1);
        } else {
          this.internalValue.push(value);
        }
      } else {
        this.internalValue = value;
        this.isOpen = false;
      }

      this.$emit('update:modelValue', this.multiple ? [...this.internalValue] : this.internalValue);
      this.$emit('change', this.multiple ? [...this.internalValue] : this.internalValue);
    },
    removeOption(option) {
      if (!this.multiple) return;
      
      const value = option.value || option;
      const index = this.internalValue.findIndex(v => v === value);
      if (index >= 0) {
        this.internalValue.splice(index, 1);
        this.$emit('update:modelValue', [...this.internalValue]);
        this.$emit('change', [...this.internalValue]);
      }
    },
    isSelected(option) {
      const value = option.value || option;
      if (this.multiple) {
        return this.internalValue.includes(value);
      }
      return value === this.internalValue;
    },
    closeDropdown(e) {
      if (!this.$el.contains(e.target)) {
        this.isOpen = false;
        this.searchQuery = '';
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.closeDropdown);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeDropdown);
  }
};
</script>

<style scoped>
.custom-dropdown {
  position: relative;
  width: 100%;
  user-select: none;
  font-family: Evolventa;
}

.dropdown-header {
  padding: 10px 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.25s ease;
  min-height: 40px;
}

.dropdown-header:hover {
  border-color: #b241d1;
}

.dropdown-header.has-selection {
  font-weight: 500;
  color: #333;
}

.dropdown-arrow {
  font-size: 12px;
  transition: transform 0.25s ease;
  color: #666;
}

.custom-dropdown.is-open .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-options-container {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 1000;
  margin-top: 5px;
  display: flex;
  flex-direction: column;
}

.dropdown-search {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.search-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  outline: none;
}

.search-input:focus {
  border-color: #b241d1;
}

.dropdown-options {
  flex: 1;
  overflow-y: auto;
}


.dropdown-option {
  display: flex;
  align-items: flex-start; /* Выравнивание по верху для многострочного текста */
  padding: 0.75rem 1rem;
  min-height: 3rem; /* Минимальная высота элемента */
}

.checkbox {
  flex: 0 0 1.25rem; /* Фиксированная ширина без растягивания */
  width: 1.25rem;
  height: 1.25rem;
  margin: 0.125rem 0.75rem 0 0; /* Отступ сверху для выравнивания с текстом */
  border: 2px solid #b241d1;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  transition: all 0.2s ease;
}

.checkbox-inner {
  color: #b241d1;
  font-size: 0.9rem;
  font-weight: bold;
  line-height: 1;
  margin-top: -1px; /* Визуальное выравнивание галочки */
}

.dropdown-option-text {
  flex: 1;
  text-align: left;
  word-break: break-word; /* Перенос длинных слов */
  padding-top: 0.125rem; /* Визуальное выравнивание текста */
}


.dropdown-option:hover {
  background-color: #f0e6ff;
}

.dropdown-option.is-selected {
  background-color: #f0e6ff;
  color: #b241d1;
  font-weight: 500;
}

.dropdown-option.is-multi-selected {
  background-color: transparent;
  color: inherit;
}

.no-results {
  padding: 10px 15px;
  color: #999;
  font-style: italic;
  text-align: center;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-top: 1px solid #eee;
  background-color: #f9f9f9;
}

.selected-tag {
  background-color: #b241d1;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.remove-tag {
  margin-left: 4px;
  cursor: pointer;
  font-size: 14px;
}

.remove-tag:hover {
  color: #d32f2f;
}

.custom-dropdown.is-disabled .dropdown-header {
  background-color: #f9f9f9;
  cursor: not-allowed;
  color: #999;
}

.custom-dropdown.is-disabled .dropdown-arrow {
  color: #ccc;
}

/* Анимации */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: 
    opacity 0.25s ease,
    transform 0.25s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>